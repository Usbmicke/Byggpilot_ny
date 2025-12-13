import 'server-only';
import { z } from 'genkit';
import { tool } from 'genkit';
import { OfferRepo } from '@/lib/dal/offer.repo';

export const listOffersTool = tool(
    {
        name: 'listOffers',
        description: 'Lists all offers (contracts) for a specific project. Use this to check if a requested work item is already included in the contract.',
        inputSchema: z.object({
            projectId: z.string().describe('The ID of the project to check offers for'),
        }),
        outputSchema: z.array(z.object({
            id: z.string(),
            title: z.string(),
            items: z.array(z.any()), // Keeping loose for flexibility, or define strict schema
            totalAmount: z.number(),
            status: z.string()
        })),
    },
    async ({ projectId }) => {
        try {
            const offers = await OfferRepo.listByProject(projectId);
            return offers;
        } catch (error: any) {
            throw new Error(`Failed to list offers: ${error.message}`);
        }
    }
);
