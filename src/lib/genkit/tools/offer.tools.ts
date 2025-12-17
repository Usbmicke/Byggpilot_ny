import 'server-only';
import { z } from 'genkit';
import { ai } from '@/lib/genkit-instance';
import { OfferRepo } from '@/lib/dal/offer.repo';

export const listOffersTool = ai.defineTool(
    {
        name: 'listOffers',
        description: 'Lists all offers (contracts) for a specific project. Use this to check if a requested work item is already included in the contract.',
        inputSchema: z.object({
            projectId: z.string().describe('The ID of the project to check offers for'),
        }),
        outputSchema: z.object({
            success: z.boolean(),
            offers: z.array(z.object({
                id: z.string(),
                title: z.string(),
                totalAmount: z.number(),
                status: z.string(),
                items: z.array(z.any())
            })),
            error: z.string().optional()
        }),
    },
    async ({ projectId }) => {
        try {
            const offers = await OfferRepo.listByProject(projectId);
            return {
                success: true,
                offers: offers.map(o => ({
                    id: o.id,
                    title: o.title,
                    totalAmount: o.totalAmount,
                    status: o.status,
                    items: o.items
                }))
            };
        } catch (error: any) {
            return { success: false, offers: [], error: `Failed to list offers: ${error.message}` };
        }
    }
);
