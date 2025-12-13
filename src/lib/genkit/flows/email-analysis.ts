import 'server-only';
import { ai } from '@/lib/genkit-instance';
import { z } from 'genkit';
import { AI_MODELS, AI_CONFIG } from '../config';

const EmailAnalysisInput = z.object({
    subject: z.string(),
    sender: z.string(),
    body: z.string(),
});

const EmailAnalysisOutput = z.object({
    intent: z.enum(['meeting', 'lead', 'ata_approval', 'other']),
    confidence: z.number(),
    summary: z.string(),
    proposedAction: z.string().optional(),
    ataId: z.string().optional(),
    calendarData: z.object({
        subject: z.string(),
        description: z.string(),
        suggestedDate: z.string().optional(), // ISO String if found
    }).optional(),
    leadData: z.object({
        name: z.string(),
        phone: z.string().optional(),
        projectType: z.string().optional(),
    }).optional(),
});

export const emailAnalysisFlow = ai.defineFlow(
    {
        name: 'emailAnalysisFlow',
        inputSchema: EmailAnalysisInput,
        outputSchema: EmailAnalysisOutput,
    },
    async (input) => {
        const prompt = `
    Analyze this email for a Swedish Construction Company (Byggfirma).
    Sender: ${input.sender}
    Subject: ${input.subject}
    Body: "${input.body}"

    Role: You are an intelligent assistant (InboxCopilot).
    Task:
    1. Determine the 'intent':
       - 'meeting': Request for a meeting, site visit (platsbesök).
       - 'lead': Job inquiry ("Kan du hjälpa mig...", "Offertförfrågan").
       - 'ata_approval': Customer replying "Ok", "Ja", "Kör på" to an ÄTA/Change Order email.
          * Triggers: Subject contains "ÄTA" or "Godkännande". Body contains affirmative short response.
       - 'other': Spam, newsletters, invoices, or irrelevant.

    2. Logic Specifics:
       - IF 'ata_approval': Try to find the ÄTA ID (e.g. "ata_..." or UUID) in the quoted body/subject. If found, put in 'ataId'.
       - IF 'meeting': Extract 'suggestedDate' (ISO). Today is ${new Date().toLocaleDateString('sv-SE')}.

    3. Extract 'summary' (For Notification):
       - Concise Swedish one-liner.
       - Example: "ÄTA Godkänd: Spotlights (Anna)" or "Nytt jobb: Köksrenovering".

    4. Return JSON matching the schema.
    `;



        // ... schemas ...

        const { output } = await ai.generate({
            model: AI_MODELS.FAST, // Speed is key for batch processing
            config: { temperature: AI_CONFIG.temperature.precise }, // Precision is key for data extraction
            prompt: prompt,
            output: { schema: EmailAnalysisOutput },
        });

        if (!output) throw new Error('AI analysis failed');
        return output;
    }
);
