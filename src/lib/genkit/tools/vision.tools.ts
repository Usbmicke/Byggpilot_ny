import 'server-only';
import { ai } from '@/lib/genkit-instance';
import { z } from 'genkit';
import { AI_MODELS } from '../config';

const AnalyzeReceiptInput = z.object({
    imageUrl: z.string().describe('The URL or Base64 string of the receipt image'),
});

export const analyzeReceiptTool = ai.defineTool(
    {
        name: 'analyzeReceipt',
        description: 'Analyzes a receipt image to extract date, total amount, vendor, and items.',
        inputSchema: AnalyzeReceiptInput,
        outputSchema: z.object({
            vendor: z.string().optional(),
            date: z.string().optional(),
            totalAmount: z.number().optional(),
            items: z.array(z.string()).optional(),
            hasChemicals: z.boolean().describe('True if any item appears to be a chemical requiring safety sheets'),
        }),
    },
    async (input) => {
        try {
            const prompt = `
      Analyze this receipt image. Extract the following in JSON format:
      - Vendor name
      - Date
      - Total amount
      - List of items
      - Check if any item is a chemical or hazardous material (e.g. paint, glue, solvent). Set hasChemicals to true if so.
    `;

            const response = await ai.generate({
                model: AI_MODELS.FAST,
                prompt: [
                    { text: prompt },
                    { media: { url: input.imageUrl } }
                ],
                config: {
                    temperature: 0.1,
                }
            });

            const text = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(text);

            return {
                vendor: data.vendor,
                date: data.date,
                totalAmount: data.totalAmount,
                items: data.items,
                hasChemicals: !!data.hasChemicals
            };

        } catch (e) {
            console.error("Vision AI failed:", e);
            return {
                vendor: "Unknown Vendor (Vision Error)",
                hasChemicals: false
            };
        }
    }
);

const AnalyzeChemicalInput = z.object({
    imageUrl: z.string().describe('Image URL of the chemical product/can'),
});

export const analyzeChemicalContainerTool = ai.defineTool(
    {
        name: 'analyzeChemicalContainer',
        description: 'Analyzes a chemical product image (e.g. Fogskum) to check for Isocyanates and generate safety info.',
        inputSchema: AnalyzeChemicalInput,
        outputSchema: z.object({
            productName: z.string(),
            containsIsocyanates: z.boolean(),
            requiresTraining: z.boolean(),
            safetyRequirements: z.array(z.string()),
        }),
    },
    async (input) => {
        try {
            const response = await ai.generate({
                model: AI_MODELS.FAST,
                prompt: [
                    {
                        text: `
                        Analyze this product image (likely construction material like 'fogskum' or paint).
                        1. Identify the product name.
                        2. Check the label/ingredients for ISOCYANATES (Isocyanater) or Diisocyanates.
                        3. If Isocyanates are found, set 'containsIsocyanates' to true.
                        4. List required protection (gloves, mask) based on safety symbols or text.
                        
                        Return JSON:
                        {
                            "productName": string,
                            "containsIsocyanates": boolean,
                            "safetyRequirements": string[]
                        }
                    ` },
                    { media: { url: input.imageUrl } }
                ],
                config: { temperature: 0.1 }
            });

            const text = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(text);

            return {
                productName: data.productName || "Unknown Product",
                containsIsocyanates: !!data.containsIsocyanates,
                safetyRequirements: data.safetyRequirements || [],
                requiresTraining: !!data.containsIsocyanates
            };

        } catch (e) {
            console.error("Chemical Vision failed:", e);
            return {
                productName: "Error Analyzing Image",
                containsIsocyanates: false,
                requiresTraining: false,
                safetyRequirements: []
            };
        }
    }
);
