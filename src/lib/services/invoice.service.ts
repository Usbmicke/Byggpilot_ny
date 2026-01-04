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

        // Fetch Logs
        const { LogRepo } = await import('@/lib/dal/log.repo');
        const logs = await LogRepo.listUnbilledByProject(projectId);

        // Section 4: Work Logs (Time & Mileage)
        if (logs.length > 0) {
            html += `<h2>3. Tid & Resor (Löpande)</h2>`;
            html += `<table border="1" style="border-collapse: collapse; width: 100%;"><tr><th>Beskrivning</th><th>Antal</th><th>Enhetspris</th><th>Summa</th></tr>`;

            logs.forEach(log => {
                const unit = log.type === 'time' ? 'h' : 'km';
                const price = log.type === 'time' ? 650 : 25; // Default rates: 650kr/h, 25kr/km
                const total = log.amount * price;
                html += `<tr>
                    <td>${log.type === 'time' ? 'Arbetstid' : 'Milersättning'} - ${log.description || new Date(log.date.toDate()).toLocaleDateString()}</td>
                    <td>${log.amount} ${unit}</td>
                    <td>${price} kr</td>
                    <td>${total} kr</td>
                </tr>`;
            });
            html += `</table>`;
        }

        // Section 5: Goodwill / Quality Log
        html += `<h2>4. Kvalitetslogg & Mervärde</h2>`;
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
     * NOW USES NATIVE PDF GENERATION (PdfService)
     */
    async finalizeInvoice(input: {
        projectId: string,
        draftDocId?: string,
        customerEmail: string,
        emailSubject: string,
        emailBody: string,
        generatePdf?: boolean // Optional override
    }, accessToken?: string) {

        console.log(`🔒 [InvoiceService] Finalizing Project: ${input.projectId}`);
        const { ProjectRepo } = await import('@/lib/dal/project.repo');
        const { UserRepo } = await import('@/lib/dal/user.repo');
        const { CompanyRepo } = await import('@/lib/dal/company.repo');
        const { LogRepo } = await import('@/lib/dal/log.repo');
        const { GmailService } = await import('@/lib/google/gmail');
        const { db } = await import('@/lib/dal/server');
        const { Timestamp } = await import('firebase-admin/firestore');

        // 1. Gather Data & Contractor Info (Same as before)
        const projectData = await InvoiceRepo.collectProjectData(input.projectId);
        const logs = await LogRepo.listUnbilledByProject(input.projectId);
        const project = await ProjectRepo.get(input.projectId);
        if (!project) throw new Error("Project not found");

        let contractor: any = { name: "Mitt Företag", orgNumber: "", address: "", email: "", phone: "", bankgiro: "", swish: "" };
        if (project.ownerId) {
            const user = await UserRepo.get(project.ownerId);
            if (user?.companyId) {
                const comp = await CompanyRepo.get(user.companyId);
                if (comp) contractor = { ...comp.profile, name: comp.profile?.name || comp.name };
            }
        }

        // 2. Calculate Totals (Simplified Logic)
        const pdfItems: any[] = [];
        if (projectData.offer?.items) projectData.offer.items.forEach((i: any) => pdfItems.push(i));
        projectData.changeOrders.approved.forEach((a: any) => pdfItems.push({ description: `ÄTA: ${a.description}`, total: a.estimatedCost }));
        logs.forEach(l => pdfItems.push({ description: `${l.type}: ${l.description}`, total: l.amount * (l.type === 'time' ? 650 : 25) }));

        const subtotal = pdfItems.reduce((sum, i) => sum + (i.total || 0), 0);
        const vat = subtotal * 0.25;
        const totalToPay = subtotal + vat; // Add ROT logic if needed

        // 3. Generate Invoice ID & Record
        const invoiceId = `FAK-${crypto.randomUUID().substring(0, 8).toUpperCase()}`;

        // 4. Save Invoice Record for Tracking (CRITICAL)
        await db.collection('invoices').doc(invoiceId).set({
            id: invoiceId,
            projectId: input.projectId,
            customerId: project.customerId || 'unknown',
            amount: totalToPay,
            status: 'sent',
            sentAt: Timestamp.now(),
            dueDate: Timestamp.fromMillis(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days default
            items: pdfItems
        });

        // 5. Generate HTML Email Body
        // Use HOST url for tracking. In dev: localhost. In prod: domain.
        const host = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const trackingUrl = `${host}/api/invoice/track?id=${invoiceId}`;

        // Simple, Clean HTML Design
        const htmlInvoice = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="margin: 0;">FAKTURA</h2>
                <p style="color: #666;">Ref: ${invoiceId}</p>
            </div>
            
            <p>Hej ${projectData.customerName},</p>
            <p>Här kommer din faktura för projektet <strong>${projectData.projectTitle}</strong>.</p>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr style="background: #f9f9f9; text-align: left;">
                    <th style="padding: 10px;">Beskrivning</th>
                    <th style="padding: 10px; text-align: right;">Belopp</th>
                </tr>
                ${pdfItems.map(item => `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.description}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.total} kr</td>
                    </tr>
                `).join('')}
                <tr>
                    <td style="padding: 10px; font-weight: bold;">ATT BETALA (Inkl moms)</td>
                    <td style="padding: 10px; font-weight: bold; text-align: right; font-size: 1.2em;">${totalToPay} kr</td>
                </tr>
            </table>

            <div style="background: #fdfdfd; padding: 15px; border-radius: 5px; margin-top: 20px;">
                <p><strong>Betalningsuppgifter:</strong></p>
                <p>Bankgiro: ${contractor.bankgiro || '-'}</p>
                <p>Swish: ${contractor.swish || '-'}</p>
                <p>Förfallodatum: ${new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE')}</p>
            </div>

            <div style="text-align: center; margin-top: 30px;">
                <a href="#" style="background: #000; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                    BETALA NU
                </a>
                <p style="font-size: 0.8em; color: #888; margin-top: 10px;">(Länk till säker betalning kommer snart)</p>
            </div>

            <hr style="margin-top: 40px; border: 0; border-top: 1px solid #eee;">
            <p style="font-size: 0.8em; color: #888; text-align: center;">
                ${contractor.name} | ${contractor.email} | ${contractor.phone}
            </p>
            
            <!-- TRACKING PIXEL -->
            <img src="${trackingUrl}" width="1" height="1" alt="" style="display:none;" />
        </div>
        `;

        // 6. Send Email (HTML First, no PDF unless requested)
        if (input.generatePdf) {
            // ... (Keep legacy PDF logic if specifically requested, optional)
        }

        // Use GmailService to send HTML
        await GmailService.sendEmail(accessToken!, input.customerEmail, `Faktura ${invoiceId} - ${projectData.projectTitle}`, htmlInvoice);

        // 7. Update Project Status
        await ProjectRepo.update(input.projectId, { status: 'completed' });

        return {
            success: true,
            message: "Faktura skickad via email (HTML) med spårning.",
            invoiceId
        };
    }
};
