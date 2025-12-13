import 'server-only';
import { z } from 'genkit';
import { tool } from 'genkit';
import { CustomerRepo } from '@/lib/dal/customer.repo';
import { UserRepo } from '@/lib/dal/user.repo';

export const createCustomerTool = tool(
    {
        name: 'createCustomer',
        description: 'Creates a new customer in the system.',
        inputSchema: z.object({
            name: z.string().describe('Name of the customer (Person or Company)'),
            email: z.string().optional(),
            phone: z.string().optional(),
            type: z.enum(['private', 'company', 'brf']).optional().describe('Type of customer (default private)'),
            ownerId: z.string().describe('The Owner UID (usually context.uid)'),
        }),
        outputSchema: z.object({
            success: z.boolean(),
            id: z.string(),
            message: z.string()
        }),
    },
    async (input) => {
        try {
            console.log(`👤 Tool: createCustomer for ${input.name}`);

            // Get Company ID from Owner
            const user = await UserRepo.get(input.ownerId);
            if (!user?.companyId) throw new Error("User has no company ID");

            const customer = await CustomerRepo.create({
                name: input.name,
                companyId: user.companyId,
                email: input.email || '',
                phone: input.phone || '',
                type: input.type || 'private',
                status: 'active'
            });

            return {
                success: true,
                id: customer.id,
                message: `Kund skapad: ${customer.name}.`
            };
        } catch (e: any) {
            return { success: false, id: '', message: e.message };
        }
    }
);

export const listCustomersTool = tool(
    {
        name: 'listCustomers',
        description: 'Lists all customers for the current user/company. Use to check if customer exists.',
        inputSchema: z.object({
            ownerId: z.string().describe('The Owner UID')
        }),
        outputSchema: z.array(z.object({
            id: z.string(),
            name: z.string(),
            email: z.string().optional()
        })),
    },
    async (input) => {
        try {
            const user = await UserRepo.get(input.ownerId);
            if (!user?.companyId) return [];
            return await CustomerRepo.listByCompany(user.companyId);
        } catch (error) {
            return [];
        }
    }
);
