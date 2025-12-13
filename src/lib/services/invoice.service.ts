import 'server-only';
import { GoogleDriveService } from '@/lib/google/drive';
import { GmailService } from '@/lib/google/gmail';
import { InvoiceRepo } from '@/lib/dal/invoice.repo';
import { ProjectRepo } from '@/lib/dal/project.repo';
import { ChangeOrderRepo } from '@/lib/dal/ata.repo';
import { Readable } from 'stream';

export const InvoiceService = {
    /**
     * Prepares the Google Doc Draft for a Final Invoice.
     */
    async prepareDraft(projectId: string, folderId?: string, includeDrafts: boolean = false, accessToken?: string) {
        // 1. Collect Data
        const data = await InvoiceRepo.collectProjectData(projectId);

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
        if (includeDrafts && data.changeOrders.draft.length > 0) {
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
        const driveRes = await GoogleDriveService.createGoogleDoc(title, html, folderId, accessToken);

        return {
            success: true,
            link: driveRes.webViewLink,
            id: driveRes.id,
            warnings: data.warnings,
            message: `Utkast skapat: ${driveRes.webViewLink}`
        };
    },


    /**
     * Finalizes the Invoice: Locks PDF, Emails Customer, Updates Project & ÄTAs.
     */
    async finalizeInvoice(input: {
        projectId: string,
        draftDocId: string,
        customerEmail: string,
        emailSubject: string,
        emailBody: string
    }, accessToken?: string) {

        console.log(`🔒 [InvoiceService] Finalizing Project: ${input.projectId}`);

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
        await ProjectRepo.update(input.projectId, { status: 'completed' });

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
    }
};
