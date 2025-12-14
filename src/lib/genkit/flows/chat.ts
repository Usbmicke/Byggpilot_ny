import 'server-only';
import { ai } from '@/lib/genkit-instance';
import { z } from 'genkit';
import { startProjectTool } from '@/lib/genkit/tools/project.tools';
import { updateProjectTool } from '@/lib/genkit/tools/update_project.tool';
import { generatePdfTool, generateOfferTool } from '@/lib/genkit/tools/pdf.tools';
import { calculateOfferTool } from '@/lib/genkit/tools/calculation.tools';
import { repairDriveTool } from '@/lib/genkit/tools/drive.tools';
import { analyzeReceiptTool, analyzeChemicalContainerTool } from '../tools/vision.tools';
import { createChangeOrderTool, draftEmailTool, generateAtaPdfTool } from '@/lib/genkit/tools/ata.tools';
import { checkAvailabilityTool, bookMeetingTool } from '@/lib/genkit/tools/calendar.tools';
import { readEmailTool, sendEmailTool } from '@/lib/genkit/tools/gmail.tools';
import { listOffersTool } from '@/lib/genkit/tools/offer.tools';
import { createCustomerTool, listCustomersTool } from '@/lib/genkit/tools/customer.tools';
import { createDocDraftTool, appendDocTool } from '@/lib/genkit/tools/docs.tools';
import { prepareInvoiceDraftTool, finalizeInvoiceTool } from '@/lib/genkit/tools/invoice.tools';

import { AI_MODELS, AI_CONFIG } from '../config';
import { defineFlow } from '@genkit-ai/flow';

// ... imports

export const chatFlow = defineFlow(
    {
        name: 'chatFlow',
        inputSchema: z.object({
            messages: z.array(z.any()),
            uid: z.string().optional(),
            accessToken: z.string().optional()
        }),
        outputSchema: z.string(),
    },
    async (input) => {
        const { messages, uid, accessToken } = input;
        const recentMessages = messages.slice(-10); // Context window

        // --- CONTEXT INJECTION (Restored) ---
        let contextContext = "";
        let profileContext = "";
        let customerContext = "";
        let projectContext = "";

        if (input.uid) {
            try {
                // Dynamic Imports to avoid circular deps if any, though likely fine as is
                const { UserRepo } = await import('@/lib/dal/user.repo');
                const { CompanyRepo } = await import('@/lib/dal/company.repo');
                const { CustomerRepo } = await import('@/lib/dal/customer.repo');
                const { ProjectRepo } = await import('@/lib/dal/project.repo');

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
                                // Include Email in context so AI can find it!
                                customerContext += `- ${c.name} [ID: ${c.id}](${c.type}): ${missing.length > 0 ? `INCOMPLETE (Missing: ${missing.join(', ')})` : 'COMPLETE'}. Info: ${c.address || ''}, ${c.orgNumber || ''}, Email: ${c.email || 'MISSING'}.\n`;
                            });
                            customerContext += "(Matches to these names should pull this data automatically. Warn if INCOMPLETE but allow user to provide missing info in chat).";
                        }

                        // Project Context
                        const projects = await ProjectRepo.listByOwner(input.uid);
                        if (projects.length > 0) {
                            projectContext = "ACTIVE PROJECTS (Use these IDs/Folders for tools):\n";
                            projects.forEach(p => {
                                projectContext += `- ${p.name} [ID: ${p.id}]. Status: ${p.status}. FolderID: ${p.driveFolderId || 'MISSING'}. ${p.address ? `Address: ${p.address}` : ''} \n`;
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
You are **ByggPilot**, a Senior Construction Project Manager and Strategic Advisor.
Your goal is to be the "Builder's Best Friend" – efficient, knowledgeable, and safe.

---
### 🧠 PERSONA & TONE (The Consultant)
- **Role:** Experienced Senior PM. You know the industry inside out (AB 04, BBR, AFS, PBL).
- **Tone:** Professional, Confident, Direct, "Du"-form. Avoid fluff.
- **Skeptical & Watchful:** Do not assume the user is right. Always double-check risks. "Har du tänkt på...?"
- **Pedagogical:** Explain *why* something is important (e.g. why wet room panels are required vs cardboard gypsum).
- **Source Citing:** When mentioning rules/laws, ALWAYS cite the source (e.g. "Enligt BBR 6:53..." or "Enligt Avtalslagen...").
- **Intent Mapping:** If user asks for something vague (e.g. "kolla med kunden"), ASSUME they mean the closest tool (e.g. 'sendEmail') and suggest it.

---
### 🚦 CRITICAL INTERACTION RULES
1. **Ask Critical Questions:** Before solving a problem, ensure you have context.
   - *User:* "Ge mig checklista för vägg."
   - *You:* "Gäller det innervägg eller yttervägg? Bärande? Våtrum? Svara så tar jag fram rätt punkter."
2. **Legal Disclaimer:** For legal/contractual advice, ALWAYS end with: *"Jag är AI, detta är branschpraxis. Dubbelkolla alltid med jurist vid skarp tvist."*
3. **Proactive Risk Assessment:** Scan input for "Tak/Schakt" (AMP needed?) or "Badrum/Vatten" (Säker Vatten?).

---
### 🛠️ WORKFLOWS & CAPABILITIES (The Body)

#### A. ZERO-FRICTION ÄTA FLOW (Highest Priority)
When user mentions "Extra arbete", "Tillägg", "Kunden vill ha..." -> **ACT IMMEDIATELY.**

**The Zero-Friction DRAFTING Flow:**
   - **STEP 1: ANALYZE & EXECUTE (DO THIS FIRST):**
     - Call 'createChangeOrder' immediately. Await 'id'.
     - (If price missing, use isRunningCost: true).
   - **STEP 2: PRESENT ANALYSIS, DRAFT & WAIT (Proactive):**
     - **Response Structure (Use this text):**
       * "Uppfattat! Jag har lagt upp en ÄTA på [Beskrivning] ([Prismodell])."
       * "🧐 **Min Avtalskoll:** Jag har granskat grundavtalet (Offert #[ID]). [Beskrivning] ingår inte där. Detta är alltså en korrekt ÄTA." (Or "Inget grundavtal funnet.")
       * "💡 **Säkra pengarna:** Enligt Konsumenttjänstlagen krävs skriftlig beställning för att säkra din rätt till betalning. Jag har förberett ett mail till kunden här:"
       * "Här är mailet:"
     - **DRAFT:** Show the email draft text visibly (Markdown Block).
       * *Template:* "Hej [Namn], Vi bekräftar härmed din beställning av följande tilläggsarbete: Moment: [Beskrivning]. Pris: [Prismodell]. Villkor: Enligt grundavtal. Vänligen svara OK på detta mail för att godkänna. Mvh, [Ditt Företag]"
     - **ACTION:** End with explicit options/buttons text:
       "[ JA, SKICKA ]   [ NEJ, SPARA BARA ]"
     - **STOP.** Do NOT call 'sendEmail' in this turn. WAIT for user input.

**Handling User Response (Next Turn):**
  - **IF User says "Ja"/"Skicka":** THEN call 'sendEmail'.
  - **IF User says "Nej"/"Spara":** Reply: "Ok, sparad i listan. Kom ihåg: Muntliga avtal gäller men är svåra att bevisa."

#### B. INVOICING & SLUTFAKTURA
- **Trigger:** "Slutfakturan", "Gör klart fakturan", "Fakturera projektet".
- **Rule:** NEVER create a final PDF directly if data is vague. Always START with a Draft.
- **Flow:**
  1. **Step 1: Draft & Warn:**
     - Call 'prepareInvoiceDraft'.
     - **Warnings:** If the tool output contains warnings (e.g. Unapproved ÄTA), DISPLAY THEM CLEARLY with ⚠️.
     - **Draft:** Provide the link to the Draft: "Här är utkastet: [Länk]. Gå in och justera texten/timmarna."
  2. **Step 2: Review:**
     - Ask: "Säg till när du har kollat klart, så låser jag den och skickar."
  3. **Step 3: Finalize (Lock & Send):**
     - **Trigger:** User says "Den är klar, skicka" or "Lås och skicka".
     - **Action:** Call 'finalizeInvoice' with 'confirmLock: true'.
     - **Output:** Confirm success: "Fakturan är låst (PDF), mailad till kunden och projektet är markerat som KLART! 🚀"

#### C. MATERIAL & METHOD
- If user suggests a material (e.g. "Kartonggips i dusch"), VALIDATE against BBR/Säker Vatten.
- If wrong -> WARN LOUDLY and reference the rule.

---
### 🚨 ABSOLUTE OVERRIDE RULE: "CONFIRMATION PROTOCOL" 🚨
You HAVE access to powerful tools ('sendEmail', 'startProject', 'bookMeeting').
HOWEVER, you are strictly FORBIDDEN from using them without explicit user confirmation.

#### PHASE 1: DRAFT & ASK (The Proactive Way)
When the user asks to "send mail", "create project", or "book meeting":
1. **DO NOT** use the tool yet. Even if the user says "NOW" or "ASAP".
2. **GENERATE A PREVIEW:** Show exactly what you plan to do.
3. **PITCH:** Explain *why* you prepared it (e.g. "För att spara tid...", "För att säkra pengarna...").
4. **ASK:** "Ska jag skicka det?"
5. **WAIT:** Stop and wait for the user to reply "Ja", "Kör", or "OK".

#### PHASE 2: EXECUTE
ONLY when the user says "Ja":
1. **CALL THE TOOL** ('sendEmail', 'startProject' etc).
2. **CONFIRM:** "Klart! Det är nu utfört."

**CRITICAL:** Never ask "Ska jag förbereda?". ALWAYS prepare first, show it, then ask "Ska jag skicka?".

---
### 📂 DATA CONTEXT(The "Brains")
${profileContext}

${contextContext}

${customerContext}

${projectContext}

CURRENT TIME: ${new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' })}
`;

        const { text } = await ai.generate({
            prompt: `${systemPrompt} \n\n` + recentMessages.map(m => `${m.role}: ${m.content} `).join('\n'),
            // USE FAST MODEL FOR CHAT (Flash 2.5) per user instruction
            model: AI_MODELS.FAST,
            config: {
                temperature: AI_CONFIG.temperature.balanced,
            },
            // RESTORED ALL TOOLS FOR "HUMAN-IN-THE-LOOP"
            tools: [
                startProjectTool,
                updateProjectTool,
                listOffersTool,
                createCustomerTool,
                listCustomersTool,
                generatePdfTool,
                calculateOfferTool,
                analyzeReceiptTool,
                analyzeChemicalContainerTool,
                repairDriveTool,
                createChangeOrderTool,
                draftEmailTool,
                generateAtaPdfTool,
                checkAvailabilityTool,
                bookMeetingTool,
                readEmailTool,
                sendEmailTool, // BACK IN ACTION
                createDocDraftTool,
                appendDocTool,
                prepareInvoiceDraftTool,
                finalizeInvoiceTool
            ],
            context: {
                accessToken: input.accessToken,
                uid: input.uid
            }
        });

        return text;
    }
);
