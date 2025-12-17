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
import { webSearchTool } from '@/lib/genkit/tools/search.tool';
import { createTaskTool, listTasksTool, completeTaskTool } from '@/lib/genkit/tools/tasks.tools';


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
                console.log(`🔍 Context Injection started for UID: ${input.uid}`);
                // Dynamic Imports to avoid circular deps if any, though likely fine as is

                const { UserRepo } = await import('@/lib/dal/user.repo');
                const { CompanyRepo } = await import('@/lib/dal/company.repo');
                const { CustomerRepo } = await import('@/lib/dal/customer.repo');
                const { ProjectRepo } = await import('@/lib/dal/project.repo');

                const user = await UserRepo.get(input.uid);
                if (!user) console.warn(`⚠️ User not found for UID: ${input.uid}`);

                if (user?.companyId) {
                    console.log(`✅ User belongs to Company ID: ${user.companyId}`);
                    const company = await CompanyRepo.get(user.companyId);
                    if (company) {
                        // Profile Context
                        if (company.profile) {
                            const p = company.profile;
                            console.log(`✅ Company Profile Loaded: ${p.name}`);
                            profileContext = `MY COMPANY PROFILE: \nName: ${p.name} \nOrgNr: ${p.orgNumber || 'MISSING'} \nAddress: ${p.address || 'MISSING'} \nPhone: ${p.contactPhone} \nEmail: ${p.contactEmail} \n(Auto - use this for contracts / PDFs)`;
                            if (!p.orgNumber || !p.address) profileContext += "\nWARNING: Company profile is incomplete. Please ask user to update Settings.";
                        } else {
                            console.warn("⚠️ Company found but 'profile' is missing.");
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
                    } else {
                        console.warn(`⚠️ CompanyRepo.get returned null for ID: ${user.companyId}`);
                    }
                } else {
                    console.warn("⚠️ User has no companyId");
                }
            } catch (e) {
                console.error("❌ Failed to inject context:", e);
            }
        }


        // --- VECTOR SEARCH (RAG) ---
        // Efficiently find regulations (BBR, AFS) or company knowledge
        let knowledgeContext = "";
        const lastUserMsg = messages.slice().reverse().find((m: any) => m.role === 'user');

        // TRIGGER LOGIC:
        // Only run expensive/slow search if user asks for specific technical/legal info.
        // Keywords: 'regler', 'afs', 'bbr', 'lag', 'asbest', 'krav', 'kapitel', 'paragraf', 'teknisk', 'afd'


        const triggerKeywords = ['regler', 'afs', 'bbr', 'lag', 'asbest', 'krav', 'kapitel', 'paragraf', 'teknisk', 'afd', 'föreskrift', 'boverket', 'avtal', 'hantverkarformulär'];

        if (lastUserMsg && triggerKeywords.some(kw => lastUserMsg.content.toLowerCase().includes(kw))) {
            try {
                const { searchKnowledgeBase } = await import('@/lib/dal/vector.store');
                console.log(`🧠 Performing RAG Search for: "${lastUserMsg.content}"`);
                const chunks = await searchKnowledgeBase(lastUserMsg.content, 3);
                if (chunks.length > 0) {
                    knowledgeContext = `\nRELEVANT KNOWLEDGE BASE (Lagboken/Praxis):\n` +
                        chunks.map(c => `[SOURCE: ${c.source}]\n${c.content}\n---`).join('\n');
                    console.log(`✅ Found ${chunks.length} knowledge chunks.`);
                }
            } catch (e) {
                console.error("⚠️ Vector Search Failed:", e);
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
### 🚦 CRITICAL SAFETY PROTOCOL (READ THIS TWICE)
**YOU ARE FORBIDDEN FROM PERFORMING SIDE-EFFECTS WITHOUT EXPLICIT CONFIRMATION.**

#### 🛑 THE "HANDS OFF" RULE (Universal)
This applies to **EVERY** tool that changes state: \`sendEmailTool\`, \`startProjectTool\`, \`bookMeetingTool\`, \`createChangeOrderTool\`.
**YOU MAY NOT USE THESE IN THE FIRST TURN.**

#### ✅ THE CORRECT FLOW (DRAFT -> CONFIRM -> EXECUTE)
1. **User Request:** "Starta projekt" or "Maila kunden".
2. **YOUR RESPONSE (STOP HERE):**
   - **Check Context:** Look at 'MY COMPANY PROFILE' and 'User' data.
   - **Draft:** Create the content (Email body, Project Name, etc).
   - **NO PLACEHOLDERS:** Never write "[Ditt Namn]". Use the actual name from the Context. If missing, ASK the user.
   - **Review:** "Jag har förberett följande..." -> Shows draft.
   - **Ask:** "Ska jag trycka på knappen?"
3. **User Reply:** "Ja", "Kör".
4. **THEN:** Call the tool.

**Wrong:** *User:* "Nytt projekt." -> *AI:* Calls \`startProjectTool\` -> "Klart." (❌ FATAL)
**Right:** *User:* "Nytt projekt." -> *AI:* "Jag lägger upp projektet 'Villa Andersson'. Adress: Storgatan 1. Ska jag skapa det?" -> *User:* "Ja" -> *AI:* Calls tool. (✅ CORRECT)

---
### 🚦 INTERACTION RULES & TONE
1. **NO ROBOT-SPEAK / PLACEHOLDERS:**
   - ❌ "Med vänlig hälsning, [Ditt Företag]"
   - ✅ "Med vänlig hälsning, ByggFirma AB" (Hämtat från Context)
   - Om du saknar data (t.ex. mitt namn), fråga: "Vad ska jag skriva under med?"

2. **ALWAYS BE SOLUTION-ORIENTED (The "Slave" Rule):**
   - **Never say "I can't".** Always find a path forward.
   - **Tone:** You are on the USER'S side. You are their Fixer.

3. **Facts vs. Guesses (ANTI-HALLUCINATION):**
   - **Step 1:** If you don't know a fact, try calling \`webSearchTool\`.
   - **Step 2 (Fallback):** If search fails, USE TRAINING DATA as "Praxis". Do not refuse.

4. **EXTERNAL COMMUNICATION IDENTITY (THE "MASK"):**
   - **Internal Role:** To the USER, you are "ByggPilot" (The Assistant).
   - **External Role:** To CUSTOMERS (Emails/PDFs), you are **THE COMPANY** (From Context).
   - **Signature Rule:** NEVER sign emails as "ByggPilot". ALWAYS sign with the Company Name from 'MY COMPANY PROFILE'.
     - ❌ "Mvh ByggPilot"
     - ✅ "Mvh Mickes Bygg" (or whatever is in context)

4. **Legal Disclaimer:** End legal advice with standard disclaimer.

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
     - **DRAFT:** Show the email draft visibly.
     - **ACTION:** End with:
       "[OPTIONS: Ja skicka, Nej spara]"
     - **STOP.** Do NOT call 'sendEmail' in this turn. WAIT for user input.
     - **STOP.** Do NOT call 'sendEmail' in this turn. WAIT for user input.

**Handling User Response (Next Turn):**
  - **IF User says "Ja"/"Skicka":** THEN call 'sendEmail'.
  - **IF User says "Nej"/"Spara":** Reply: "Ok, sparad i listan. Kom ihåg: Muntliga avtal gäller men är svåra att bevisa."

#### B. OFFICIAL PROJECT START
- **Trigger:** User says "New Project", "Starta jobb", "Ny kund".
- **Action:**
  1. **Gather Info:** Customer Name, Project Name, Address.
  2. **Draft:** Prepare the project structure.
  3. **Confirm:** "Jag lägger upp projektet [Namn]... Ska jag köra?"
  4. **Execute:** Call \`startProjectTool\`.

#### C. PROACTIVE RISK ASSESSMENT (AMP / KMA)
- **Trigger:** User mentions high-risk keywords: "Tak", "Schakt", "Ställning", "Asbest", "Hög höjd", "Rivning".
- **Action:**
  1. **Pause & Warner:** "Detta låter som ett riskmoment (AFS 1999:3)."
  2. **Suggest AMP:** "Ska jag upprätta en Arbetsmiljöplan (AMP) för detta?"
  3. **Execute:** If yes, call \`createDocDraftTool\` with type 'AMP'.

#### D. SMART INBOX & COMMUNICATION
- **Trigger:** User says "Maila X", "Svara på mailet", "Boka möte".
- **Action:**
  1. **Draft First:** ALWAYS draft the email content based on context.
     - **STRICT:** Do NOT add unprompted excuses (e.g. "late"). NEVER sign as "ByggPilot".
     - **Signature:** Use '${profileContext}' name.
  2. **Confirm:** "Här är utkastet... Ska jag skicka?"
     - **CRITICAL:** Do NOT mention "Thread ID" or "UID" in the question. Just ask "Ska jag skicka?".
  3. **Execute:** Call \`sendEmailTool\` or \`bookMeetingTool\`.


#### E. INVOICE ASSISTANT
- **Trigger:** User says "Fakturera", "Skicka räkning".
- **Action:**
  1. **Draft:** Use \`prepareInvoiceDraftTool\`.
  2. **Confirm:** Show valid invoice details (Belopp, Moms, Rot?).
  3. **Execute:** Call \`finalizeInvoiceTool\` ONLY after confirmation.

#### F. GOOGLE TASKS INTELLIGENCE ("The Memory")
- **Trigger:** "Påminn mig", "Lägg till uppgift", "Vi måste fixa X", eller AI-förslag.
- **Action:**
  1. **Suggest/Draft:** "Ska jag lägga till '[Uppgift]' i listan [Projekt]?"
  2. **Execute:** Call \`createTaskTool\`.
  3. **Manage:** Use \`listTasksTool\` to view and \`completeTaskTool\` to close items.

#### I. INTERNET & KNOWLEDGE (The Brain)
- **Trigger:** User asks about facts not in your training data or specific up-to-date info.
- **Action:** Call \`webSearchTool\`.
- **Response:** "Enligt snabb sökning..." + Reference the source link.

`;

        const { text } = await ai.generate({
            prompt: `${systemPrompt} \n\n` + recentMessages.map(m => `${m.role}: ${m.content} `).join('\n'),
            // USE FAST MODEL FOR CHAT (Flash 2.5) per user instruction
            model: AI_MODELS.FAST,
            config: {
                temperature: AI_CONFIG.temperature.balanced,
            },
            // RESTORED ALL TOOLS FOR "HUMAN-IN-THE-LOOP" + ADDED WEB SEARCH & TASKS
            tools: [
                webSearchTool,
                createTaskTool, listTasksTool, completeTaskTool, // NEW: Task Tools
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
                sendEmailTool,
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
