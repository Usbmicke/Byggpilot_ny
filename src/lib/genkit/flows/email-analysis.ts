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
    intent: z.enum(['meeting', 'lead', 'other']),
    confidence: z.number(),
    summary: z.string(),
    proposedAction: z.string().optional(),
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
       - 'meeting': Request for a meeting, site visit (platsbesök), or inspection.
       - 'lead': Job inquiry, quote request (offertförfrågan), or new project.
       - 'other': Spam, newsletters, invoices, or irrelevant.

    2. If 'meeting', extract the 'suggestedDate'.
       - Look for dates like "onsdag kl 14" (Wednesday 14:00).
       - Assume the meeting is in the future relative to today: ${new Date().toISOString()}.
       - If only generic "next week", pick a likely candidate or leave null.
       - Format: ISO String (YYYY-MM-DDTHH:mm:ss).

    3. Extract 'summary':
       - This should be a helpful, conversational summary in Swedish.
       - Example: "Anna vill boka möte på onsdag angående takbyte." or "Ny offertförfrågan från Johan om altanbygge."
       - Include user intent and key details.

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
