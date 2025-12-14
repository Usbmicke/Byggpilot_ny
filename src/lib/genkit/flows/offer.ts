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
        const { PriceService } = await import('@/lib/services/price.service');

        const prompt = `
        You are an expert construction estimator (Byggmästare) in Sweden.
        Based on these notes:
        Project: "${input.projectTitle}"
        Notes: "${input.notes}"

        1. Break down work into logical line items (Arbete, Material, etc).
        2. ESTIMATE QUANTITIES CAREFULLY.
        3. IGNORE PRICES. Set 'unitPrice' to 0. The system will price them.
        4. "unit" should be Swedish (tim, st, m2, lpm).
        5. Write professional Intro and Closing texts.

        Return valid JSON.
        `;

        const { output } = await ai.generate({
            model: AI_MODELS.SMART,
            config: { temperature: AI_CONFIG.temperature.creative },
            prompt: prompt,
            output: { schema: OfferOutputSchema }
        });

        if (!output) throw new Error('AI failed to generate offer structure');

        // --- SAFE PRICING ENGINE ---
        // Overwrite AI prices with Standard Price Book
        const pricedItems = PriceService.priceItems(output.items);

        return {
            ...output,
            items: pricedItems
        };
    }
);
