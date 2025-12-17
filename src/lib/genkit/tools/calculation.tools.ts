import 'server-only';
import { ai } from '@/lib/genkit-instance';
import { z } from 'genkit';
import { RecipeRepo } from '@/lib/dal/recipe.repo';

const CalculateOfferInput = z.object({
    recipeId: z.string().describe('The ID of the recipe to use'),
    quantity: z.number().describe('The quantity of the work (e.g., area in m2)'),
    margin: z.number().default(0.15).describe('Profit margin (decimal, e.g. 0.15 for 15%)'),
    riskBuffer: z.number().default(0.10).describe('Additional risk buffer (decimal)'),
});

export const calculateOfferTool = ai.defineTool(
    {
        name: 'calculateOffer',
        description: 'Calculates the price and cost for a job based on a recipe and quantity.',
        // MASTER PLAN v2: This tool is currently DETERMINISTIC (Math).
        // If AI is added here (e.g. for analysis), it MUST use AI_MODELS.SMART.
        // We do not gamble with customer money.
        inputSchema: CalculateOfferInput,
        outputSchema: z.object({
            totalPrice: z.number(),
            costMaterials: z.number(),
            costLabor: z.number(),
            totalHours: z.number(),
            breakdown: z.array(z.string()),
            kmaFlags: z.array(z.string()).optional(),
            netProfit: z.number(),
        }),
    },
    async (input) => {
        const recipe = await RecipeRepo.get(input.recipeId);

        if (!recipe) {
            throw new Error(`Recipe with ID ${input.recipeId} not found.`);
        }

        // Constants (could be config)
        const HOURLY_RATE = 650; // SEK/h

        // Calculations
        const laborHours = recipe.laborHoursPerUnit * input.quantity;
        const laborCost = laborHours * HOURLY_RATE;

        let materialCost = 0;
        const materialBreakdown: string[] = [];

        recipe.materials.forEach(mat => {
            const amount = mat.quantityPerUnit * input.quantity;
            const cost = amount * mat.costPerUnit;
            materialCost += cost;
            materialBreakdown.push(`${mat.name}: ${amount.toFixed(2)} ${mat.unit} (~${cost.toFixed(0)} kr)`);
        });

        // Apply Risk to Base Cost
        // Recipe might have inherent risk factor + input risk buffer
        const recipeRisk = recipe.riskFactor || 0;
        const totalRisk = Math.max(recipeRisk, input.riskBuffer);

        const baseCost = laborCost + materialCost;
        const costWithRisk = baseCost * (1 + totalRisk);

        // Apply Margin
        const totalPrice = costWithRisk * (1 + input.margin);
        const netProfit = totalPrice - baseCost; // Or - costWithRisk depending on accounting definition

        return {
            totalPrice: Math.round(totalPrice),
            costMaterials: Math.round(materialCost),
            costLabor: Math.round(laborCost),
            totalHours: parseFloat(laborHours.toFixed(1)),
            breakdown: materialBreakdown,
            kmaFlags: recipe.kmaRequirements || [],
            netProfit: Math.round(netProfit),
        };
    }
);
