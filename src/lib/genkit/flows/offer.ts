import 'server-only';
import { ai } from '@/lib/genkit-instance';
import { z } from 'genkit';
import { AI_MODELS, AI_CONFIG } from '../config';

// Input Schema: User provides rough notes
const OfferInputSchema = z.object({
    projectTitle: z.string(),
    notes: z.string(),
});

// Output Schema: AI generates structured offer data
const OfferOutputSchema = z.object({
    title: z.string(),
    introText: z.string(),
    items: z.array(z.object({
        description: z.string(),
        quantity: z.number(),
        unit: z.string(), // e.g. "st", "tim", "m2"
        unitPrice: z.number(),
    })),
    closingText: z.string(),
});

export const offerFlow = ai.defineFlow(
    {
        name: 'offerFlow',
        inputSchema: OfferInputSchema,
        outputSchema: OfferOutputSchema,
    },
    async (input) => {
        const prompt = `
        You are an expert construction estimator (Byggmästare) in Sweden.
        Create a professional offer based on these notes:
        Project: "${input.projectTitle}"
        Notes: "${input.notes}"

        1. Break down the work into logical line items (Material, Labor/Arbete, ROT if applicable).
        2. Estimate realistic prices in SEK (Swedish Krona).
        3. Write a professional Intro and Closing text in Swedish.
        4. "unit" should be Swedish (tim, st, m2, lpm).
        
        Return ONLY valid JSON matching the schema.
        `;



        // ... schemas ...

        const { output } = await ai.generate({
            model: AI_MODELS.SMART,
            config: { temperature: AI_CONFIG.temperature.creative }, // Creative for writing sales text
            prompt: prompt,
            output: { schema: OfferOutputSchema }
        });

        if (!output) throw new Error('AI failed to generate offer structure');
        return output;
    }
);
