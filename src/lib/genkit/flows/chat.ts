import 'server-only';
import { ai } from '@/lib/genkit-instance';
import { z } from 'genkit';
import { startProjectTool } from '@/lib/genkit/tools/project.tools';
import { generatePdfTool, generateOfferTool } from '@/lib/genkit/tools/pdf.tools';
import { calculateOfferTool } from '@/lib/genkit/tools/calculation.tools';
import { repairDriveTool } from '@/lib/genkit/tools/drive.tools';
import { analyzeReceiptTool } from '../tools/vision.tools';
import { createChangeOrderTool, draftEmailTool, generateAtaPdfTool } from '@/lib/genkit/tools/ata.tools';
import { AI_MODELS, AI_CONFIG } from '../config';

// Simple Message Schema
const MessageSchema = z.object({
    role: z.enum(['user', 'model', 'system']),
    content: z.string(),
});

const ChatInput = z.object({
    messages: z.array(MessageSchema),
    uid: z.string().optional(),
    accessToken: z.string().optional(), // Passed from client for Google Drive Access
});

// Imports for context
import { UserRepo } from '@/lib/dal/user.repo';
import { CompanyRepo } from '@/lib/dal/company.repo';
import { CustomerRepo } from '@/lib/dal/customer.repo';
import { ProjectRepo } from '@/lib/dal/project.repo';

export const chatFlow = ai.defineFlow(
    {
        name: 'chatFlow',
        inputSchema: ChatInput,
        outputSchema: z.string(),
    },
    async (input) => {
        console.log(`🌊 [chatFlow] Triggered. UID: ${input.uid}, Token Length: ${input.accessToken?.length || 0}`);
        // Optimize Context: Keep only last N messages to save tokens and prevent context overflow
        const recentMessages = input.messages.slice(-AI_CONFIG.maxHistory);

        // --- CONTEXT INJECTION ---
        let contextContext = "";
        let profileContext = "";
        let customerContext = "";
        let projectContext = "";

        if (input.uid) {
            try {
                const user = await UserRepo.get(input.uid);
                if (user?.companyId) {
                    const company = await CompanyRepo.get(user.companyId);
                    if (company) {
                        // Profile Context
                        if (company.profile) {
                            const p = company.profile;
                            profileContext = `MY COMPANY PROFILE: \nName: ${p.name} \nOrgNr: ${p.orgNumber || 'MISSING'} \nAddress: ${p.address || 'MISSING'} \nPhone: ${p.contactPhone} \nEmail: ${p.contactEmail} \n(Auto - use this for contracts / PDFs)`;
                            if (!p.orgNumber || !p.address) profileContext += "\nWARNING: Company profile is incomplete. Please ask user to update Settings.";
                        }
                        // Preferences Context
                        if (company.context) {
                            contextContext = `MY PREFERENCES & CONTEXT: \n${company.context.preferences} \n\nRISKS / WARNINGS: \n${company.context.risks} \n(Use this to guide advice)`;
                        }

                        // Customer Context
                        const customers = await CustomerRepo.listByCompany(user.companyId);
                        if (customers.length > 0) {
                            customerContext = "CUSTOMER REGISTRY (Known Clients):\n";
                            customers.forEach(c => {
                                const missing = [];
                                if (!c.address) missing.push('Address');
                                if (!c.orgNumber) missing.push('SSN/OrgNr');

                                customerContext += `- ${c.name} [ID: ${c.id}](${c.type}): ${missing.length > 0 ? `INCOMPLETE (Missing: ${missing.join(', ')})` : 'COMPLETE'}.Info: ${c.address || ''}, ${c.orgNumber || ''}, ${c.email || ''}.\n`;
                            });
                            customerContext += "(Matches to these names should pull this data automatically. Warn if INCOMPLETE but allow user to provide missing info in chat).";
                        }

                        // Project Context (NEW)
                        const projects = await ProjectRepo.listByOwner(input.uid);
                        if (projects.length > 0) {
                            projectContext = "ACTIVE PROJECTS (Use these IDs/Folders for tools):\n";
                            projects.forEach(p => {
                                projectContext += `- ${p.name} [ID: ${p.id}].Status: ${p.status}.FolderID: ${p.driveFolderId || 'MISSING'}. ${p.address ? `Address: ${p.address}` : ''} \n`;
                            });
                            projectContext += "(When generating PDFs, ALWAYS use the 'driveFolderId' from a matching project if available).";
                        }
                    }
                }
            } catch (e) {
                console.error("Failed to inject context:", e);
            }
        }

        const systemPrompt = `SYSTEM ROLE:
You are **ByggPilot**, a Senior Construction Project Manager acting as a proactive Co-Pilot for a Swedish construction company.
Your goal is to be the "Builder's Best Friend" – efficient, knowledgeable, and safe.

---
### 🧠 PERSONA & TONE
- **Role:** Experienced Senior PM. You know the industry (AB 04, BBR, AFS).
- **Tone:** Professional, Confident, Direct, "Du"-form. Avoid fluff.
- **Language:** Swedish (unless asked otherwise).
- **Proactive:** Don't just answer. Suggest the next step. (e.g. "Ska jag boka in det?", "Vill du ha ett avtal på det?").

---
### 🛡️ SAFETY & CONFIRMATION (CRITICAL)
- **User Control:** NEVER perform destructive or major actions (like wiping data, mass-repairing Drive, or starting big projects) without being transparent.
- **Ambiguity:** If the user says "Fixa mappen", CHECK context. If unclear, ASK: "Jag ser att mapp X saknas för projekt Y. Ska jag köra reparationsverktyget för att återskapa den?"
- **Fuzzy Matching:** If user says "Fredrik", look at [ACTIVE PROJECTS] below. If you find "4921-105 - Fredrik Altan", ASK: "Menar du projekt **4921-105 - Fredrik Altan**?" before acting.

---
### 📋 CAPABILITIES & TOOLS
1. **PROJECTS ('startProject'):**
   - Initiates new jobs. Warn if Customer seems new/unknown.
2. **CONTRACTS ('generatePdf'):**
   - **Trigger:** When user mentions "avtal", "hantverkarformulär", "kontrakt".
   - **Context:** Use [MY COMPANY PROFILE] and [ACTIVE PROJECTS] to pre-fill data.
   - **Linking:** ALWAYS try to find the 'projectId' and 'customerId' from context.
   - **Check:** If data is missing (e.g. User SSN), ASK for it nicely.
3. **CALCULATIONS ('calculateOffer'):**
   - Create offers based on standard recipes.
4. **VISION ('analyzeReceipt'):**
   - Check receipts for KMA risks (Chemicals).
5. **DRIVE DOCTOR ('repairDrive'):**
   - **Trigger:** "Mappar saknas", "Fixa drive", "Laga mappar".
   - **Rule:** EXPLAIN what you will do (recreate folders) and ASK for confirmation unless the user explicitly said "Laga allt nu".
6. **ÄTA & CHANGE ORDERS ('createChangeOrder'):**
   - **Trigger:** "Extra arbete", "Tillägg", "Vi la till...", "Kunden ville ha...".
   - **Flow:** 
     1. Identify Project (Fuzzy Match).
     2. Extract Description, Quantity, Cost (Guess if missing).
     3. **CONFIRM:** "Ska jag lägga in en ÄTA för [Proj] avseende [Beskrivning] ([Kostnad] kr)?"
     4. On Yes -> Call Tool.
     5. **FOLLOW UP:** "ÄTA skapad. Ska jag förbereda ett mail till kunden för godkännande?" -> use 'draftEmail'.
     6. **PDF:** If asking for "Paper", "PDF" or "Underlag" -> use 'generateAtaPdf'.

---
### ⚠️ RISK MANAGEMENT ("The Putter")
- **Keywords:** If user mentions "Tak", "Asbest", "Schakt", "Våtrum", "Heta arbeten" -> **STOP & WARN**.
- **Action:** Remind them of risks. "Obs: Takjobb innebär fallrisk. Har du en AMP?"
- **Checklists:** Offer to generate a safety checklist.

---
### 📝 CHECKLIST GENERATION
If the user needs a checklist (KMA, Startup, Material), generate it using Markdown Task Lists:
> **Checklista: [Namn]**
> - [ ] Punkt 1
> - [ ] Punkt 2
>
(This format renders nicely in the UI).

---
### 📂 DATA CONTEXT (The "Brains")
${profileContext}

${contextContext}

${customerContext}

${projectContext}
`;

        const { text } = await ai.generate({
            prompt: `${systemPrompt} \n\n` + recentMessages.map(m => `${m.role}: ${m.content} `).join('\n'),
            model: AI_MODELS.SMART, // Upgraded model for intelligence
            config: {
                temperature: 0.4, // Lower temperature for more consistent/professional outputs
            },
            tools: [startProjectTool, generatePdfTool, calculateOfferTool, analyzeReceiptTool, repairDriveTool, createChangeOrderTool, draftEmailTool, generateAtaPdfTool],
            context: {
                accessToken: input.accessToken,
                uid: input.uid
            }
        });

        return text;
    }
);
