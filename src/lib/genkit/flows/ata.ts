import 'server-only';
import { ai } from '@/lib/genkit-instance';
import { z } from 'genkit';
import { AI_MODELS, AI_CONFIG } from '../config';

// Input: The raw text from Voice Transcription or Chat
const AtaInput = z.object({
    text: z.string(),
    projectContext: z.string().optional(), // E.g., "Project Harri Fönsterbyte"
});

// Output: Structured Data for the Draft
const AtaOutput = z.object({
    intent: z.enum(['create_ata', 'finalize_project', 'other']),
    confidence: z.number(),
    data: z.object({
        description: z.string().describe("Clear Swedish description of the change, e.g. '2 st extra spotlights'"),
        quantity: z.number().default(1),
        estimatedCost: z.number().optional().describe("Estimated cost in SEK if mentioned or inferable, else 0"),
        type: z.enum(['material', 'work', 'other']).default('other'),
    }).optional(),
    reply: z.string().describe("Conversational response to user confirming what was heard"),
});

export const ataFlow = ai.defineFlow(
    {
        name: 'ataFlow',
        inputSchema: AtaInput,
        outputSchema: AtaOutput,
    },
    async (input) => {
        const prompt = `
    You are an AI Construction Assistant (ByggPilot).
    
    Context: ${input.projectContext || 'No specific project selected'}
    User Input: "${input.text}"

    Task:
    1. Analyze if the user wants to add an "ÄTA" (Ändrings- och Tilläggsarbete / Change Order) or Finalize the project.
    2. Intent 'create_ata':
       - Extract WHAT (description), HOW MANY (quantity), COST (if mentioned).
       - Classify type (material/work).
       - Draft a confirmation message.
    
    3. Intent 'finalize_project':
       - If user says "Klar med projektet", "Fixa faktura", etc.
    
    4. Intent 'other':
       - If unrelated.

    Output JSON matching the schema.
    `;

        const { output } = await ai.generate({
            model: process.env.GENKIT_ENV === 'mock' ? AI_MODELS.MOCK : AI_MODELS.FAST, // Gemini Flash for speed/cost (or Mock)
            config: { temperature: 0.3 }, // Low temp for precision
            prompt: prompt,
            output: { schema: AtaOutput },
        });

        if (!output) throw new Error('AI Analysis failed');
        return output;
    }
);
