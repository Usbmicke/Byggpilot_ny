import 'server-only';
import { ai } from '@/lib/genkit-instance';
import { z } from 'genkit';
import { InvoiceService } from '@/lib/services/invoice.service';

export const prepareInvoiceDraftTool = ai.defineTool(
    {
        name: 'prepareInvoiceDraft',
        description: 'Creates a Google Doc draft for the Final Invoice (Slutfaktura). Collects all project data (Offer, ÄTA, Expenses) and formats it into a professional document. Returns a link to the editable draft.',
        inputSchema: z.object({
            projectId: z.string().describe("The ID of the project to invoice."),
            folderId: z.string().optional().describe("The Google Drive Folder ID for the project (where to save the invoice)."),
            includeDrafts: z.boolean().optional().describe("If true, includes unapproved ÄTAs in the draft (with warning). Default false."),
        }),
        outputSchema: z.object({
            success: z.boolean(),
            link: z.string(),
            warnings: z.array(z.string()),
            message: z.string(),
        }),
    },
    async (input, context: any) => {
        const accessToken = context?.accessToken || context?.context?.accessToken as string | undefined;
        try {
            return await InvoiceService.prepareDraft(input.projectId, input.folderId, input.includeDrafts, accessToken);
        } catch (e: any) {
            console.error("Invoice Draft Failed:", e);
            return {
                success: false,
                link: "",
                warnings: [],
                message: `Kunde inte skapa fakturaunderlag: ${e.message}`
            };
        }
    }
);

export const finalizeInvoiceTool = ai.defineTool(
    {
        name: 'finalizeInvoice',
        description: 'Sends the Final Invoice via Email (HTML). Supports "Email-First". Also saves the tracking record. REQUIRES USER CONFIRMATION.',
        inputSchema: z.object({
            projectId: z.string(),
            customerEmail: z.string().email(),
            emailSubject: z.string(),
            emailBody: z.string(),
            generatePdf: z.boolean().optional().describe("If true, generates and attaches a PDF (Old School). Default false."),
        }),
        outputSchema: z.object({
            success: z.boolean(),
            invoiceId: z.string().optional(),
            message: z.string(),
        }),
    },
    async (input, context: any) => {
        const accessToken = context?.accessToken || context?.context?.accessToken as string | undefined;

        try {
            return await InvoiceService.finalizeInvoice({
                projectId: input.projectId,
                customerEmail: input.customerEmail,
                emailSubject: input.emailSubject,
                emailBody: input.emailBody,
                generatePdf: input.generatePdf
            }, accessToken);
        } catch (e: any) {
            console.error("Finalize Failed:", e);
            return {
                success: false,
                message: `Fel vid finalisering: ${e.message}`
            };
        }
    }
);

export const checkInvoiceStatusTool = ai.defineTool(
    {
        name: 'checkInvoiceStatusTool',
        description: 'Checks the status of sent invoices. Use this to see if a customer has viewed the invoice or if it is overdue. Needed for "Smart Reminders".',
        inputSchema: z.object({
            projectId: z.string().optional(),
            status: z.enum(['sent', 'viewed', 'paid', 'overdue']).optional()
        }),
        outputSchema: z.object({
            invoices: z.array(z.object({
                id: z.string(),
                recipient: z.string(),
                amount: z.number(),
                status: z.string(),
                viewedAt: z.string().optional(),
                dueDate: z.string(),
                daysUntilDue: z.number()
            }))
        })
    },
    async (input) => {
        const { db } = await import('@/lib/dal/server');
        // Simple query
        let query = db.collection('invoices');
        if (input.projectId) query = query.where('projectId', '==', input.projectId) as any;
        if (input.status) query = query.where('status', '==', input.status) as any;

        const snapshot = await query.get();
        const invoices = snapshot.docs.map(doc => {
            const data = doc.data();
            const due = data.dueDate?.toDate ? data.dueDate.toDate() : new Date();
            const viewed = data.viewedAt?.toDate ? data.viewedAt.toDate() : null;
            const now = new Date();
            const diffTime = due.getTime() - now.getTime();
            const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            return {
                id: data.id,
                recipient: data.customerId, // Should ideally be name
                amount: data.amount,
                status: data.status,
                viewedAt: viewed ? viewed.toISOString() : undefined,
                dueDate: due.toISOString().split('T')[0],
                daysUntilDue
            };
        });

        return { invoices };
    }
);
