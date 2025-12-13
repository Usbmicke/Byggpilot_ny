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
        description: 'LOCKS & SENDS the Final Invoice. Converts the Google Doc Draft to PDF, emails it to the customer, updates project status to "completed", and marks all drafted ÄTAs as approved. REQUIRES USER CONFIRMATION.',
        inputSchema: z.object({
            projectId: z.string(),
            draftDocId: z.string().describe("The Google Doc ID of the reviewed invoice draft."),
            customerEmail: z.string().email(),
            emailSubject: z.string(),
            emailBody: z.string(),
            confirmLock: z.boolean().describe("Must be true to proceed. Confirms user has reviewed the draft."),
        }),
        outputSchema: z.object({
            success: z.boolean(),
            pdfLink: z.string(),
            message: z.string(),
        }),
    },
    async (input, context: any) => {
        const accessToken = context?.accessToken || context?.context?.accessToken as string | undefined;

        if (!input.confirmLock) {
            return { success: false, pdfLink: "", message: "Avbruten: Du måste bekräfta låsning." };
        }

        try {
            return await InvoiceService.finalizeInvoice(input, accessToken);
        } catch (e: any) {
            console.error("Finalize Failed:", e);
            return {
                success: false,
                pdfLink: "",
                message: `Fel vid finalisering: ${e.message}`
            };
        }
    }
);
