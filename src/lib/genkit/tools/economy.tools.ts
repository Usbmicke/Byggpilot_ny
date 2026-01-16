import 'server-only';
import { ai } from '@/lib/genkit-instance';
import { z } from 'genkit';
import { logReceiptExpenseAction } from '@/app/actions';

export const logReceiptTool = ai.defineTool(
    {
        name: 'logReceipt',
        description: 'Logs a receipt/expense to the project economy system. Uploads image to Drive and adds entry to the Economy Doc.',
        inputSchema: z.object({
            projectId: z.string().describe("The ID of the project"),
            vendor: z.string().optional(),
            date: z.string().optional(),
            totalAmount: z.number().optional(),
            items: z.array(z.string()).optional(),
            imageBase64: z.string().optional().describe("Base64 string of the receipt image (if available from vision)"),
        }),
        outputSchema: z.object({
            success: z.boolean(),
            message: z.string(),
            docLink: z.string().optional(),
        }),
    },
    async (input) => {
        try {
            const { projectId, imageBase64, ...data } = input;
            const result = await logReceiptExpenseAction(projectId, data, imageBase64);

            if (!result.success) {
                return { success: false, message: result.error || "Unknown error" };
            }

            return {
                success: true,
                message: result.message || "Receipt logged successfully",
                docLink: result.docLink
            };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    }
);
