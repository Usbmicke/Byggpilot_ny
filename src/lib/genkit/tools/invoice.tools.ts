import 'server-only';
import { ai } from '@/lib/genkit-instance';
import { z } from 'genkit';
import { GoogleDriveService } from '@/lib/google/drive';
import { InvoiceRepo } from '@/lib/dal/invoice.repo';
import { Readable } from 'stream';

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
            // 1. Collect Data
            const data = await InvoiceRepo.collectProjectData(input.projectId);

            // 2. Generate HTML Content
            let html = `<h1>SLUTFAKTURA - UNDERLAG</h1>`;
            html += `<p><strong>Projekt:</strong> ${data.projectTitle}</p>`;
            html += `<p><strong>Kund:</strong> ${data.customerName}</p>`;
            html += `<p><strong>Datum:</strong> ${new Date().toLocaleDateString('sv-SE')}</p>`;
            html += `<hr>`;

            // Section 1: Grundkontrakt
            html += `<h2>1. Grundkontrakt</h2>`;
            if (data.offer) {
                html += `<p>Enligt godkänd offert (${data.offer.id})</p>`;
                html += `<ul>`;
                data.offer.items.forEach((item: any) => {
                    html += `<li>${item.description}: ${item.total} kr</li>`;
                });
                html += `</ul>`;
                html += `<p><strong>Delsumma Kontrakt:</strong> ${data.offer.total} kr</p>`;
            } else {
                html += `<p><em>Ingen bunden offert hittades. Faktureras löpande?</em></p>`;
            }

            // Section 2: ÄTA (Approved)
            html += `<h2>2. Ändringar & Tillägg (ÄTA)</h2>`;
            if (data.changeOrders.approved.length > 0) {
                html += `<table border="1" style="border-collapse: collapse; width: 100%;"><tr><th>Beskrivning</th><th>Kostnad</th></tr>`;
                data.changeOrders.approved.forEach((ata: any) => {
                    html += `<tr><td>${ata.description} (Godkänd)</td><td>${ata.estimatedCost} kr</td></tr>`;
                });
                html += `</table>`;
            } else {
                html += `<p>Inga godkända tillägg.</p>`;
            }

            // Section 3: Drafts (If requested)
            if (input.includeDrafts && data.changeOrders.draft.length > 0) {
                html += `<h3>⚠️ Ej Godkända ÄTA (Utkast)</h3>`;
                html += `<p><em>Dessa saknar skriftligt OK. Kontrollera med kund.</em></p>`;
                html += `<ul>`;
                data.changeOrders.draft.forEach((ata: any) => {
                    html += `<li>${ata.description}: ${ata.estimatedCost} kr</li>`;
                });
                html += `</ul>`;
            }

            // Section 4: Goodwill / Quality Log
            html += `<h2>3. Kvalitetslogg & Mervärde</h2>`;
            html += `<p>För att säkerställa långsiktig kvalitet har vi även utfört följande kontroller utan extra debitering:</p>`;
            html += `<ul><li>Kontrollmätt fuktkvot i underlag.</li><li>Grovstädat arbetsplats dagligen.</li><li>(Fyll på med egna punkter...)</li></ul>`;

            html += `<hr>`;
            html += `<p><strong>Att betala (exkl moms):</strong> [SUMMA EJ UTRÄKNAD I UTKAST]</p>`;

            // 3. Create Google Doc
            const title = `Slutfaktura - ${data.projectTitle}`;
            const driveRes = await GoogleDriveService.createGoogleDoc(title, html, input.folderId, accessToken);

            return {
                success: true,
                link: driveRes.webViewLink,
                warnings: data.warnings,
                message: `Utkast skapat: ${driveRes.webViewLink}`
            };

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

import { GmailService } from '@/lib/google/gmail';
import { ProjectRepo } from '@/lib/dal/project.repo';
import { ChangeOrderRepo } from '@/lib/dal/ata.repo';

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
            console.log(`🔒 [finalizeInvoice] Processing Project: ${input.projectId}`);

            // 1. Export PDF
            const { buffer } = await GoogleDriveService.exportPdf(input.draftDocId, accessToken);
            const pdfName = `Slutfaktura_${input.projectId}_${new Date().toISOString().split('T')[0]}.pdf`;

            // 2. Upload PDF to Drive (Keep Record)
            const project = await ProjectRepo.get(input.projectId);
            const targetFolder = project?.driveFolderId;

            const pdfStream = Readable.from(buffer);

            const pdfUpload = await GoogleDriveService.uploadFile(pdfName, 'application/pdf',
                pdfStream,
                targetFolder,
                accessToken
            );


            // 3. Send Email
            await GmailService.sendEmailWithAttachment(accessToken!, input.customerEmail, input.emailSubject, input.emailBody, {
                filename: pdfName,
                content: buffer
            });

            // 4. Update Database
            await ProjectRepo.update(input.projectId, { status: 'completed' }); // Or 'invoiced' if enum allows

            // Mark Draft ÄTAs as Approved (Internal Record)
            const atas = await ChangeOrderRepo.listByProject(input.projectId);
            const drafts = atas.filter(a => a.status === 'draft');
            for (const ata of drafts) {
                await ChangeOrderRepo.updateStatus(ata.id, 'approved', 'manual', 'Invoice Finalization');
            }

            return {
                success: true,
                pdfLink: pdfUpload.webViewLink,
                message: "Slutfaktura skickad! Projektet markerat som klart."
            };

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
