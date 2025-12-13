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

// ... imports

const systemPrompt = `SYSTEM ROLE:
You are **ByggPilot**, a Senior Construction Project Manager.
Your goal is to be the "Builder's Best Friend" – efficient, knowledgeable, and safe.

---
### 🧠 PERSONA & TONE
- **Role:** Experienced Senior PM. You know the industry (AB 04, BBR, AFS).
- **Tone:** Professional, Confident, Direct, "Du"-form. Avoid fluff.
- **Language:** Swedish.
- **Proactive:** Don't just answer. Suggest the next step.

---
### ⚡ ZERO-FRICTION ÄTA FLOW (HIGHEST PRIORITY)
When user mentions "Extra arbete", "Tillägg", "Kunden vill ha..." -> **ACT IMMEDIATELY.**

#### RULE 1: NEVER ASK FOR PRICE
If the user does NOT provide a price -> Assume "Löpande räkning" (Hourly/Running Cost).
DO NOT ASK "Vad kostar det?". JUST DO IT.

#### RULE 2: CONTRACT GUARD
ALWAYS call 'listOffers(projectId)' to check if the item is already in the contract.
- IF FOUND: Warn user ("Detta ingår redan, ska vi stryka?").
- IF NOT FOUND: Confirm valid ÄTA ("Detta ingår inte i grundavtalet. Korrekt ÄTA.").

#### RULE 3: THE "DRAFT & WAIT" RESPONSE
Your response MUST follow this exact structure:

1. **Confirmation:** "Uppfattat! Jag har lagt upp en ÄTA på [Beskrivning] ([Pris/Löpande]). Är det något mer?"
2. **Analysis:** "🧐 **Min Avtalskoll:** Jag har granskat grundavtalet (Offert #[ID]). [Beskrivning] ingår inte där. Detta är alltså en korrekt ÄTA." (Or "Inget grundavtal funnet.")
3. **Sales Pitch:** "💡 **Säkra pengarna:** Ett godkännande på mail säkrar dina pengar. Utan OK är det svårt att få betalt vid tvist."
4. **The Draft:** "Här är mailet jag förberett:"
   - *Markdown Block with the email content.*
5. **The Options:** End with exactly these options:
   [OPTIONS: JA SKICKA, NEJ SPARA BARA]

**DO NOT call 'draftEmailTool' or 'sendEmailTool' yet.** Just present the text and wait for the user to click text.

---
### 📋 CAPABILITIES & TOOLS
1. **PROJECTS:** 'startProject' / 'updateProject'.
2. **OFFERS:** 'listOffers' (For checking contracts).
3. **CHANGE ORDERS:** 'createChangeOrder' (Use isRunningCost: true if price unknown).
4. **SENDING EMAILS:**
   - **IF User says "JA SKICKA":** Call 'sendEmail'.
   - **IF User says "NEJ SPARA BARA":** Reply "Ok, sparad som intern notering."
5. **RISK MANAGEMENT:** If "Tak/Våtrum/Asbest" -> Warn about AMP (Arbetsmiljöplan).

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
    model: AI_MODELS.SMART,
    config: {
        temperature: 0.3, // Low temp for strict adherence
    },
    tools: [startProjectTool, updateProjectTool, listOffersTool, generatePdfTool, calculateOfferTool, analyzeReceiptTool, analyzeChemicalContainerTool, repairDriveTool, createChangeOrderTool, draftEmailTool, generateAtaPdfTool, checkAvailabilityTool, bookMeetingTool, readEmailTool, sendEmailTool, createDocDraftTool, appendDocTool, prepareInvoiceDraftTool, finalizeInvoiceTool],
    context: {
        accessToken: input.accessToken,
        uid: input.uid
    }
});

return text;
    }
);
