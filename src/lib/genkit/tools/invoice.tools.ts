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
            draftDocId: z.string().optional().describe("If provided, finalizes this Google Doc instead of generating a new PDF."),
            generatePdf: z.boolean().optional().describe("If true, generates and attaches a PDF (Old School). Default false."),
            applyRot: z.boolean().optional().describe("Set to true if customer is private individual requesting ROT deduction (30% on labor)."),
            applyReverseVat: z.boolean().optional().describe("Set to true if customer is a Construction Company (Umvänd byggmoms applies)."),
            // A-konto fields
            invoiceType: z.enum(['final', 'on_account']).optional().describe("Default 'final'. Set to 'on_account' for partial billing."),
            amount: z.number().optional().describe("Required if invoiceType is 'on_account'. Fixed amount to bill.")
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
            // New "Living Doc" Flow
            if (input.draftDocId) {
                const { finalizeDocToPdfTool } = await import('@/lib/genkit/tools/pdf.tools'); // Circular ref check? Tools imports might be tricky.
                // Better to call service directly or duplicate logic to avoid circular dept if these files import each other.
                // Actually, pdf.tools imports nothing from invoice tools. But invoice tools likely doesn't import pdf tools yet.
                // To avoid circular dependency issues in 'index.ts', let's use the SERVICE pattern or invoke the internal logic.
                // For now, let's just implement the 'finalize' logic here using DriveService, as it's cleaner than tool-calling-tool.

                const { GoogleDriveService } = await import('@/lib/google/drive');
                const { Readable } = await import('stream');

                // 1. Export PDF
                const { buffer } = await GoogleDriveService.exportPdf(input.draftDocId, accessToken);
                const stream = Readable.from(buffer);

                // 2. Upload
                // We don't have folder ID here easily without looking up project. 
                // Assuming InvoiceService handles "Sent" logic, but here we just need a PDF link for email.
                // Let's save it to a temp location or project folder?
                // InvoiceService.finalizeInvoice expects 'pdfBuffer' or similar if we want to attach it.
                // Actually InvoiceService.finalizeInvoice generates the PDF internally if we don't pass one... 
                // We need to modify InvoiceService to accept a pre-generated PDF or Link.

                // 3. Finalize with Custom PDF Buffer
                return await InvoiceService.finalizeInvoice({
                    projectId: input.projectId,
                    customerEmail: input.customerEmail,
                    emailSubject: input.emailSubject,
                    emailBody: input.emailBody,
                    generatePdf: false,
                }, accessToken, buffer);
            }

            return await InvoiceService.finalizeInvoice({
                projectId: input.projectId,
                customerEmail: input.customerEmail,
                emailSubject: input.emailSubject,
                emailBody: input.emailBody,
                emailBody: input.emailBody,
                generatePdf: input.generatePdf,
                applyRot: input.applyRot,
                applyReverseVat: input.applyReverseVat,
                invoiceType: input.invoiceType,
                amount: input.amount
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
