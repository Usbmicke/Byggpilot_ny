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

        **YOUR MISSION: Create a STRUCTURED DRAFT for the user to review.**
        
        Rules:
        1. Break down work into logical line items (Arbete, Material, Etablering, etc).
        2. **ESTIMATE QUANTITIES CAREFULLY**, but if unsure, be conservative.
        3. **PRICING:** Set 'unitPrice' to 0. The system has a Price Book that will overwrite this.
        4. **UNITS:** Use Swedish standard: "tim" (hours), "st" (pieces), "m2", "lpm", "kpl" (complete package).
        5. **TEXTS:** Write professional Intro and Closing texts.
           - Intro: "Här kommer offert på..."
           - Closing: "Offereras enligt ABT 06..."
        
        **IMPORTANT:** If you are guessing a quantity (e.g. guessing 20m2 from "small room"), append "(UPPSKATTAT)" to the description so the user knows to check it.

        Return valid JSON matching the schema.
        `;

        const { output } = await ai.generate({
            model: process.env.GENKIT_ENV === 'mock' ? AI_MODELS.MOCK : AI_MODELS.SMART,
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
