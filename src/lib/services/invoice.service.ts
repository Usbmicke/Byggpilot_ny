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
    /**
     * Finalizes the Invoice: Locks PDF, Emails Customer, Updates Project & ÄTAs.
     * NOW USES NATIVE PDF GENERATION (PdfService)
     */
    async finalizeInvoice(input: {
        projectId: string,
        draftDocId?: string, // Optional now, we use DB data
        customerEmail: string,
        emailSubject: string,
        emailBody: string
    }, accessToken?: string) {

        console.log(`🔒 [InvoiceService] Finalizing Project: ${input.projectId}`);
        const { PdfService } = await import('@/lib/services/pdf.service');
        const { ProjectRepo } = await import('@/lib/dal/project.repo');
        const { UserRepo } = await import('@/lib/dal/user.repo');
        const { CompanyRepo } = await import('@/lib/dal/company.repo');

        // 1. Gather Data (Source of Truth = DB)
        const projectData = await InvoiceRepo.collectProjectData(input.projectId);

        // Fetch Contractor (Company) Info
        const project = await ProjectRepo.get(input.projectId);
        if (!project) throw new Error("Project not found");

        let contractor: any = {
            name: "Mitt Företag",
            orgNumber: "556000-0000",
            address: "Adressvägen 1, 123 45 Staden"
        };

        if (project.ownerId) {
            const user = await UserRepo.get(project.ownerId);
            if (user?.companyId) {
                const comp = await CompanyRepo.get(user.companyId);
                if (comp) {
                    contractor = {
                        name: comp.profile?.name || comp.name,
                        orgNumber: comp.profile?.orgNumber || "",
                        address: comp.profile?.address || "",
                        email: comp.profile?.contactEmail || "",
                        phone: comp.profile?.contactPhone || "",
                        bankgiro: comp.profile?.bankgiro,
                        plusgiro: comp.profile?.plusgiro,
                        swish: comp.profile?.swish,
                        website: comp.profile?.website
                    };
                }
            }
        }

        // Map Items (Offer + ÄTAs)
        const pdfItems: any[] = [];

        // Offer Items
        if (projectData.offer && projectData.offer.items) {
            projectData.offer.items.forEach((item: any) => {
                const isRot = (item.description.toLowerCase().includes('arbete') || item.description.toLowerCase().includes('montering'));
                pdfItems.push({
                    description: item.description,
                    quantity: item.quantity,
                    unit: item.unit,
                    pricePerUnit: item.unitPrice,
                    total: item.quantity * item.unitPrice,
                    isRotEligible: isRot
                });
            });
        }

        // Approved ÄTAs
        projectData.changeOrders.approved.forEach((ata: any) => {
            pdfItems.push({
                description: `ÄTA: ${ata.description}`,
                quantity: ata.quantity || 1,
                unit: ata.unit || 'st',
                pricePerUnit: ata.estimatedCost, // Assuming estimatedCost is unit price or total? Usually total for ÄTA.
                // If estimatedCost is TOTAL, we should adjust.
                // Repo says: estimatedCost: number; // Exkl moms
                // Let's assume quantity 1 for simplicity if not specified
                total: ata.estimatedCost,
                isRotEligible: (ata.type === 'work') // Explicit type check from Repo
            });
        });

        // Calculations
        let subtotal = 0;
        let rotDeduction = 0;
        const vatRate = 0.25;

        pdfItems.forEach(item => {
            subtotal += item.total;
            if (item.isRotEligible) {
                rotDeduction += Math.round(item.total * 0.30); // 30% ROT
            }
        });

        const vatAmount = subtotal * vatRate;
        const totalToPay = subtotal + vatAmount - rotDeduction;

        const pdfData = {
            id: `FAK-${Date.now().toString().slice(-6)}`, // Simple auto-gen ID
            date: new Date().toLocaleDateString('sv-SE'),
            projectTitle: projectData.projectTitle,
            contractor: contractor,
            customer: {
                name: projectData.customerName,
                address: "" // We should fetch customer address if possible, leaving empty for now
            },
            items: pdfItems,
            totals: {
                subtotal,
                vatAmount,
                rotDeduction: rotDeduction > 0 ? rotDeduction : undefined,
                totalToPay
            }
        };

        // 2. Generate PDF
        const buffer = await PdfService.generateInvoice(pdfData);
        const pdfName = `Slutfaktura_${input.projectId}_${new Date().toISOString().split('T')[0]}.pdf`;

        // 3. Upload PDF to Drive
        const targetFolder = project?.driveFolderId;
        const pdfStream = Readable.from(buffer);
        const pdfUpload = await GoogleDriveService.uploadFile(pdfName, 'application/pdf',
            pdfStream,
            targetFolder,
            accessToken
        );

        // 4. Send Email
        await GmailService.sendEmailWithAttachment(accessToken!, input.customerEmail, input.emailSubject, input.emailBody, {
            filename: pdfName,
            content: buffer
        });

        // 5. Update Database
        await ProjectRepo.update(input.projectId, { status: 'completed' });

        // Mark Draft ÄTAs as Approved (Internal Record)
        const drafts = projectData.changeOrders.draft;
        for (const ata of drafts) {
            await ChangeOrderRepo.updateStatus(ata.id, 'approved', 'manual', 'Invoice Finalization');
        }

        return {
            success: true,
            pdfLink: pdfUpload.webViewLink,
            message: "Slutfaktura (PDF) skapad och skickad! Projektet markerat som klart."
        };
    }
};
