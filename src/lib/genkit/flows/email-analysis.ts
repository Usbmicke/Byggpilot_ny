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
    Analyze this email for a Construction Company (Byggfirma).
    Sender: ${input.sender}
    Subject: ${input.subject}
    Body: "${input.body}"

    Determine if this is a:
    - 'meeting': Request for a meeting, site visit, or inspection.
    - 'lead': New job inquiry, quote request, or project discussion.
    - 'other': Spam, newsletters, invoices, or irrelevant.

    If 'meeting', extract a suggested date/time (assume current year if missing). Format as ISO (YYYY-MM-DDTHH:mm:ss). If "Next Tuesday at 10", calculate it relative to today (${new Date().toISOString()}).
    If 'lead', extract contact info.

    Return JSON matching the schema.
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
