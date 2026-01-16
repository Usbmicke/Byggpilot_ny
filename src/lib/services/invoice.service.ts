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
        generatePdf?: boolean, // Optional override
        applyRot?: boolean, // [NEW] ROT-avdrag (30% på arbete)
        applyReverseVat?: boolean, // [NEW] Omvänd byggmoms
        invoiceType?: 'final' | 'on_account', // [NEW] A-konto
        amount?: number // [NEW] Manual amount for A-konto
    }, accessToken?: string, customPdfBuffer?: Buffer) {

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

        // AUTO-DETECT REVERSE VAT (Business Logic Requirement 1)
        // If applyReverseVat is undefined, check customer type.
        if (input.applyReverseVat === undefined && project.customerId) {
            const { CustomerRepo } = await import('@/lib/dal/customer.repo');
            const customer = await CustomerRepo.get(project.customerId);
            if (customer && (customer.type === 'company' || customer.type === 'subcontractor')) {
                console.log("⚖️ Auto-Enabling Reverse VAT (B2B Detected)");
                input.applyReverseVat = true;
            }
        }

        // 2. Calculate Totals with ROT & Reverse VAT Logic
        let invoiceItems: any[] = [];
        let totalLabor = 0;
        let totalMaterial = 0;
        let totalOther = 0;

        // --- A-KONTO LOGIC (PHASE 8) ---
        if (input.invoiceType === 'on_account') {
            if (!input.amount) throw new Error("Amount is required for On-Account invoice.");
            console.log(`🧾 Generating ON-ACCOUNT invoice: ${input.amount} kr`);

            invoiceItems.push({
                description: `A-konto / Lyft (Enligt överenskommelse)`,
                cost: input.amount,
                type: 'other' // A-konto is usually flat, hard to split Labor/Material for ROT unless specified.
            });
            totalOther = input.amount;
            // NOTE: ROT is usually not applicable on pure A-konto unless specified. 
            // We assume NO ROT for generic A-konto in Phase 1.
            if (input.applyRot) {
                console.warn("⚠️ ROT request ignored for A-konto (Phase 1 limitation). Only Final Invoice handles ROT splits.");
                input.applyRot = false;
            }

        } else {
            // --- STANDARD FINAL INVOICE LOGIC ---

            // A. Process Offer Items (Assume mixed/material unless specified? For now treat as 'Other'/Material to be safe, OR split if structure allows)
            // Note: Offer usually implies strict fixed price, harder to split for ROT unless defined.
            // STRATEGY: Treat Offer as 'Other' (No ROT) unless we implement detailed Offer item types later.
            if (projectData.offer?.items) {
                projectData.offer.items.forEach((i: any) => {
                    invoiceItems.push({ ...i, type: 'contract' });
                    totalOther += (i.total || 0); // Safe fallback
                });
            }

            // B. Process ÄTA
            projectData.changeOrders.approved.forEach((a: any) => {
                const cost = a.estimatedCost || 0;
                if (a.type === 'work') {
                    totalLabor += cost;
                } else {
                    totalMaterial += cost; // Material or Other
                }
                invoiceItems.push({
                    description: `ÄTA: ${a.description}`,
                    cost: cost,
                    type: a.type
                });
            });

            // C. Process Logs (Time & Mileage)
            logs.forEach(l => {
                const price = l.type === 'time' ? 650 : 25;
                const cost = l.amount * price;
                if (l.type === 'time') {
                    totalLabor += cost;
                    invoiceItems.push({ description: `Arbete: ${l.description}`, cost, type: 'work' });
                } else {
                    // Mileage is technically not 'material' but definitely not 'labor' for ROT.
                    totalOther += cost;
                    invoiceItems.push({ description: `Resor: ${l.description} (${l.amount}km)`, cost, type: 'other' });
                }
            });
        }

        // CALCULATION ENGINE
        const subtotal = totalLabor + totalMaterial + totalOther;

        // ROT Logic (30% on Labor)
        let rotDeduction = 0;
        if (input.applyRot) {
            rotDeduction = Math.floor(totalLabor * 0.30); // 30% av arbetskostnad
            // Note: Max limit (50k/person) is USER responsibility to check via Skatteverket. We just do the math.
        }

        // VAT / Reverse VAT Logic
        const vatRate = input.applyReverseVat ? 0 : 0.25;
        const vatAmount = subtotal * vatRate;

        // Grand Total
        // (Subtotal - ROT) + Moms? 
        // NO. ROT is a partial payment.
        // Customer pays: (Subtotal + Moms) - ROT.
        // Wait, ROT is on Labor ONLY. 
        // Moms is calculated on the FULL Amount (before ROT deduction).
        // Standard:
        //   Arbete: 1000
        //   Moms: 250
        //   Totalt: 1250
        //   ROT: -300 (30% av 1000)
        //   Att betala: 950.

        // Reverse VAT:
        //   Arbete: 1000
        //   Moms: 0
        //   Totalt: 1000
        //   ROT? Usually not combined with Reverse VAT (B2B only).
        //   Rule: ROT is for Private Individuals. Reverse VAT is for Construction Companies.
        //   They are Mutually Exclusive.

        let totalToPay = 0;
        let legalText = "";

        if (input.applyReverseVat) {
            // Case B2B
            totalToPay = subtotal; // No VAT
            legalText = `Omvänd skattskyldighet för byggtjänster gäller. Köparen (${projectData.customerName}) är skattskyldig.`;
            rotDeduction = 0; // Force disable ROT if RevVAT is on
        } else {
            // Case Standard / ROT
            totalToPay = subtotal + vatAmount - rotDeduction;
        }


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
            items: invoiceItems,
            rotDeduction,
            reverseVat: !!input.applyReverseVat
        });

        // 5. Generate HTML Email Body
        // Use HOST url for tracking. In dev: localhost. In prod: domain.
        const host = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const trackingUrl = `${host}/api/invoice/track?id=${invoiceId}`;

        // HTML Generator
        const htmlInvoice = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px; border-radius: 8px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="margin: 0;">${input.invoiceType === 'on_account' ? 'A-KONTO FAKTURA' : 'SLUTFAKTURA'}</h2>
                <p style="color: #666;">Ref: ${invoiceId}</p>
            </div>
            
            <p>Hej ${projectData.customerName},</p>
            <p>Här kommer din faktura för projektet <strong>${projectData.projectTitle}</strong>.</p>
            
            ${legalText ? `<div style="background: #eef; border: 1px solid #ccd; padding: 10px; margin: 10px 0; font-size: 0.9em; color: #335;">ℹ️ ${legalText}</div>` : ''}

            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr style="background: #f9f9f9; text-align: left;">
                    <th style="padding: 10px;">Beskrivning</th>
                    <th style="padding: 10px; text-align: right;">Belopp</th>
                </tr>
                ${invoiceItems.map(item => `
                    <tr>
                        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.description}</td>
                        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.cost} kr</td>
                    </tr>
                `).join('')}
                
                <!-- Totals Block -->
                <tr><td colspan="2" style="border-bottom: 2px solid #ccc;"></td></tr>
                
                <tr>
                    <td style="padding: 5px 10px; color: #666;">Delsumma (exkl moms)</td>
                    <td style="padding: 5px 10px; text-align: right;">${subtotal} kr</td>
                </tr>
                <tr>
                    <td style="padding: 5px 10px; color: #666;">Moms (${input.applyReverseVat ? '0%' : '25%'})</td>
                    <td style="padding: 5px 10px; text-align: right;">${vatAmount} kr</td>
                </tr>

                ${rotDeduction > 0 ? `
                <tr style="color: #28a745;">
                    <td style="padding: 5px 10px;"><strong>- ROT-avdrag (30% av arbete)</strong></td>
                    <td style="padding: 5px 10px; text-align: right;"><strong>-${rotDeduction} kr</strong></td>
                </tr>
                ` : ''}

                <tr>
                    <td style="padding: 10px; font-weight: bold; font-size: 1.1em;">ATT BETALA</td>
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
        let attachments: any[] = [];
        if (customPdfBuffer) {
            attachments.push({
                filename: `Faktura_${invoiceId}.pdf`,
                content: customPdfBuffer
            });
        }

        if (input.generatePdf && !customPdfBuffer) {
            // Legacy: Generate PDF on the fly if requested and not provided
            // For now we skip implementing the legacy "generate on fly" here to keep it simple, 
            // assuming the Tool handles generation or we strictly rely on HTML-first.
        }

        // Use GmailService to send HTML
        await GmailService.sendEmail(accessToken!, input.customerEmail, `Faktura ${invoiceId} - ${projectData.projectTitle}`, htmlInvoice, attachments);

        // 7. Update Project Status
        // 7. Update Project Status (Only complete if Final Invoice)
        if (input.invoiceType !== 'on_account') {
            await ProjectRepo.update(input.projectId, { status: 'completed' });
        } else {
            console.log("Invoice sent, but Project remains ACTIVE (A-konto)");
        }

        return {
            success: true,
            message: `Faktura skickad! (ROT: ${rotDeduction}kr, Omvänd Moms: ${input.applyReverseVat ? 'JA' : 'NEJ'})`,
            invoiceId
        };
    }
};
