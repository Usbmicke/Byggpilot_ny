import 'server-only';
// Rebuild trigger: pdf-lib installed
import { ai } from '@/lib/genkit-instance';
import { z } from 'genkit';
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import { GoogleDriveService } from '@/lib/google/drive';
import { Readable } from 'stream';

const H17Input = z.object({
    contractor: z.object({
        name: z.string(),
        orgNumber: z.string(),
        address: z.string(),
        contact: z.string().optional(),
    }),
    customer: z.object({
        name: z.string(),
        idNumber: z.string().describe("Personnummer/Orgnummer"),
        address: z.string(),
        contact: z.string().optional(),
    }),
    scope: z.object({
        address: z.string(),
        description: z.string(),
    }),
    price: z.object({
        type: z.enum(['fixed', 'hourly', 'approx']),
        amount: z.number(),
        vatIncluded: z.boolean().default(true),
    }),
    time: z.object({
        startDate: z.string(),
        endDate: z.string(),
    }),
    rot: z.boolean().default(true),
    targetFolderId: z.string().optional(),
    projectId: z.string().optional().describe("The ID of the project this belongs to. IF FolderID is missing in context, provide this!")
});

export const generatePdfTool = ai.defineTool(
    {
        name: 'generatePdf',
        description: 'Generates a "Hantverkarformuläret 17" contract PDF and saves it to Google Drive.',
        inputSchema: H17Input,
        outputSchema: z.object({
            fileId: z.string(),
            webViewLink: z.string(),
            message: z.string(),
        }),
    },
    async (input, context: any) => {
        // Handle nested context from Genkit
        const accessToken = context?.accessToken || context?.context?.accessToken as string | undefined;
        console.log(`[Tool: generatePdf] Creating H17 for ${input.customer.name}. Access Token present: ${!!accessToken}`);


        // --- JIT FOLDER REPAIR ---
        let finalFolderId = input.targetFolderId;

        if (!finalFolderId && input.projectId) {
            console.log(`[Tool: generatePdf] No folder ID provided, checking project ${input.projectId}...`);
            try {
                const { ProjectRepo } = await import('@/lib/dal/project.repo');
                const project = await ProjectRepo.get(input.projectId);

                if (project) {
                    if (project.driveFolderId) {
                        // ISO Structure: Save into "1_Ritningar & Kontrakt"
                        console.log(`[Tool: generatePdf] Project found. Ensuring subfolder '1_Ritningar & Kontrakt'...`);
                        const { GoogleDriveService } = await import('@/lib/google/drive');
                        finalFolderId = await GoogleDriveService.ensureFolderExists('1_Ritningar & Kontrakt', project.driveFolderId);
                    } else {
                        console.log(`[Tool: generatePdf] Project has no folder. Creating Full Structure...`);
                        const { GoogleDriveService } = await import('@/lib/google/drive');

                        // We need the parent "02_Pågående Projekt" generally, but relying on "ByggPilot - Mitt Företag" lookup might be slow/complex here without context.
                        // Ideally we use createProjectStructure. 
                        // For self-healing fallback, let's keep it simple or call the new robust method?
                        // Let's call ensureRootStructure to be safe and Get "02_Pågående Projekt"

                        const { UserRepo } = await import('@/lib/dal/user.repo');
                        const { CompanyRepo } = await import('@/lib/dal/company.repo');

                        let companyName = "Mitt Företag";
                        if (project.ownerId) {
                            const user = await UserRepo.get(project.ownerId);
                            if (user?.companyId) {
                                const comp = await CompanyRepo.get(user.companyId);
                                if (comp) companyName = comp.profile?.name || comp.name || "Mitt Företag";
                            }
                        }

                        const rootStruct = await GoogleDriveService.ensureRootStructure(companyName, accessToken);
                        const projectsRoot = rootStruct.folders['02_Pågående Projekt'];

                        const res = await GoogleDriveService.createProjectStructure(project.name, projectsRoot, accessToken);
                        await ProjectRepo.update(project.id, { driveFolderId: res.projectRootId });

                        finalFolderId = res.subfolders['1_Ritningar & Kontrakt'];
                        console.log(`[Tool: generatePdf] Created ISO Structure. Target: ${finalFolderId}`);
                    }
                }
            } catch (err) {
                console.error("JIT Folder Repair Failed:", err);
            }
        }
        // -------------------------

        // 1. Create PDF
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595.28, 841.89]); // A4
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const smallFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

        let y = height - 50;
        const margin = 50;

        // Helpers
        const drawText = (text: string, size: number = 10, isBold: boolean = false, xOffset: number = 0) => {
            page.drawText(text, {
                x: margin + xOffset,
                y,
                size,
                font: isBold ? fontBold : font,
                color: rgb(0, 0, 0),
            });
            y -= (size + 5);
        };

        const drawSection = (title: string) => {
            y -= 10;
            page.drawRectangle({ x: margin, y, width: width - (margin * 2), height: 20, color: rgb(0.9, 0.9, 0.9) });
            page.drawText(title, { x: margin + 5, y: y + 5, size: 12, font: fontBold });
            y -= 25;
        };

        // --- DRAW CONTENT ---

        // Header
        drawText('Hantverkarformuläret 17', 24, true);
        drawText('Avtal för reparations- och ombyggnadsarbeten (Konsumentverket/Byggindustrin)', 8, false);
        y -= 20;

        // A. Parter
        drawSection('A. PARTER');

        // Contractor
        const startY = y;
        drawText('HANTVERKARE (Näringsidkare):', 10, true);
        drawText(`Namn/Firma: ${input.contractor.name}`);
        drawText(`Org.nr: ${input.contractor.orgNumber}`);
        drawText(`Adress: ${input.contractor.address}`);
        if (input.contractor.contact) drawText(`Kontakt: ${input.contractor.contact}`);

        // Customer (Right Column logic sim)
        // Reset Y for second column but keep min Y
        const col2X = width / 2;
        let y2 = startY;

        page.drawText('BESTÄLLARE (Konsument):', { x: col2X, y: y2, size: 10, font: fontBold });
        y2 -= 15;
        page.drawText(`Namn: ${input.customer.name}`, { x: col2X, y: y2, size: 10, font: font });
        y2 -= 15;
        page.drawText(`Pers.nr: ${input.customer.idNumber}`, { x: col2X, y: y2, size: 10, font: font });
        y2 -= 15;
        page.drawText(`Adress: ${input.customer.address}`, { x: col2X, y: y2, size: 10, font: font });

        // Sync Y
        y = Math.min(y, y2) - 20;

        // B. Omfattning
        drawSection('B. OMFATTNING');
        drawText(`Arbetsplats: ${input.scope.address}`);
        drawText('Arbetsbeskrivning:', 10, true);

        // Multiline handling for description
        const descLines = input.scope.description.match(/.{1,90}/g) || [];
        descLines.forEach(line => drawText(line, 10));

        y -= 10;

        // D. Pris
        drawSection('D. PRIS');
        let priceText = '';
        if (input.price.type === 'fixed') priceText = `FAST PRIS: ${input.price.amount} kr`;
        else if (input.price.type === 'hourly') priceText = `LÖPANDE RÄKNING: ${input.price.amount} kr/tim`;
        else priceText = `UNGEFÄRLIGT PRIS: ${input.price.amount} kr`;

        if (input.price.vatIncluded) priceText += ' (Inklusive moms)';
        else priceText += ' (Exklusive moms)';

        drawText(priceText, 12, true);

        // E. ROT
        drawSection('E. ROT-AVDRAG');
        if (input.rot) drawText('[X] Ja, arbete ska utföras med ROT-avdrag (30% arbetskostnad).');
        else drawText('[ ] Nej, inget ROT-avdrag.');

        // F. Tider
        drawSection('F. TIDER');
        drawText(`Startdatum: ${input.time.startDate}`);
        drawText(`Slutdatum: ${input.time.endDate}`);

        // Signatures (Placeholder)
        y -= 50;
        drawSection('SIGNATURER');
        drawText('..................................................          ..................................................');
        drawText('Datum & Underskrift Hantverkare                 Datum & Underskrift Beställare');


        // 2. Serialize
        const pdfBytes = await pdfDoc.save();

        // 3. Upload to Drive using our new Service
        // We need to convert Uint8Array to a format Node stream understands or just pass buffer if supported.
        // googleapis create usually accepts stream. Readable.from(Buffer.from(pdfBytes))

        let fileId = 'error';
        let webViewLink = 'error';

        if (finalFolderId) {
            try {
                // Convert Uint8Array to Buffer
                const buffer = Buffer.from(pdfBytes);
                // Create readable stream
                const stream = Readable.from(buffer);

                const uploadRes = await GoogleDriveService.uploadFile(
                    `Avtal - ${input.customer.name}.pdf`,
                    'application/pdf',
                    stream,
                    finalFolderId,
                    accessToken
                );
                fileId = uploadRes.id;
                webViewLink = uploadRes.webViewLink;

            } catch (error: any) {
                console.error("PDF Gen Upload Failed:", error);
                return {
                    fileId: 'error',
                    webViewLink: '',
                    message: `PDF generated but upload failed: ${error.message}`
                };
            }
        } else {
            console.warn("No targetFolderId or Project Context provided. Returning Base64 Data URI.");
            const base64Pdf = Buffer.from(pdfBytes).toString('base64');
            const dataUri = `data:application/pdf;base64,${base64Pdf}`;

            return {
                fileId: 'memory-only',
                webViewLink: dataUri,
                message: `PDF genererad (Kunde ej sparas till Drive). [📄 Klicka här för att öppna/ladda ner PDF](${dataUri})`
            }
        }

        return {
            fileId,
            webViewLink,
            message: `Hantverkarformuläret 17 generated for ${input.customer.name}`,
        };
    }
);

const OfferInput = z.object({
    contractor: z.object({
        name: z.string(),
        orgNumber: z.string(),
        address: z.string(),
        contact: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        website: z.string().optional(),
        bankgiro: z.string().optional(),
        plusgiro: z.string().optional(),
        swish: z.string().optional(),
    }),
    customer: z.object({
        name: z.string(),
        address: z.string(),
    }),
    project: z.object({
        name: z.string(),
        description: z.string(),
    }),
    items: z.array(z.object({
        description: z.string(),
        quantity: z.number(),
        unit: z.string(),
        pricePerUnit: z.number(),
        total: z.number(),
    })),
    totals: z.object({
        subtotal: z.number(),
        vatAmount: z.number(),
        rotDeduction: z.number().optional(),
        totalToPay: z.number(), // Net total after ROT and VAT
    }),
    targetFolderId: z.string().optional(),
});

export const generateOfferTool = ai.defineTool(
    {
        name: 'generateOffer',
        description: 'Generates a professional Offer/Quote PDF and saves it to Google Drive.',
        inputSchema: OfferInput,
        outputSchema: z.object({
            fileId: z.string(),
            webViewLink: z.string(),
            message: z.string(),
        }),
    },
    async (input, context: any) => {
        console.log(`[Tool: generateOffer] Creating Offer for ${input.customer.name}`);
        const accessToken = context?.accessToken as string | undefined;

        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595.28, 841.89]); // A4
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // Colors
        const primaryColor = rgb(0.2, 0.2, 0.8); // Blue-ish
        const grayColor = rgb(0.5, 0.5, 0.5);

        let y = height - 50;
        const margin = 50;

        // Helpers
        const drawText = (text: string, options: any = {}) => {
            page.drawText(text, {
                x: margin,
                y,
                size: 10,
                font: font,
                color: rgb(0, 0, 0),
                ...options
            });
        };

        // --- HEADER ---
        drawText('OFFERT', { size: 24, font: fontBold, color: primaryColor });
        y -= 30;
        drawText(`Datum: ${new Date().toLocaleDateString('sv-SE')}`, { color: grayColor });
        y -= 40;

        // --- PARTIES ---
        const startY = y;

        // Contractor (Left)
        drawText(input.contractor.name, { font: fontBold, size: 11 });
        y -= 15;
        drawText(input.contractor.address);
        y -= 15;
        drawText(`Org.nr: ${input.contractor.orgNumber}`);
        y -= 15;
        if (input.contractor.email) drawText(input.contractor.email);

        // Customer (Right)
        y = startY; // Reset Y
        const col2X = width / 2 + 20;

        page.drawText('Mottagare:', { x: col2X, y: y, size: 9, font: font, color: grayColor });
        y -= 15;
        page.drawText(input.customer.name, { x: col2X, y: y, size: 11, font: fontBold });
        y -= 15;
        page.drawText(input.customer.address, { x: col2X, y: y, size: 10, font: font });

        y = startY - 80;

        // --- PROJECT ---
        page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
        y -= 20;
        drawText('Projekt:', { font: fontBold });
        drawText(input.project.name, { x: margin + 60 });
        y -= 20;

        // --- ITEMS TABLE ---
        // Header
        page.drawRectangle({ x: margin, y: y - 5, width: width - (margin * 2), height: 25, color: rgb(0.95, 0.95, 0.95) });
        drawText('Beskrivning', { y, font: fontBold });
        page.drawText('Antal', { x: width - 200, y, size: 10, font: fontBold });
        page.drawText('A-pris', { x: width - 130, y, size: 10, font: fontBold });
        page.drawText('Totalt', { x: width - margin - 40, y, size: 10, font: fontBold }); // Right align-ish
        y -= 30;

        // Rows
        input.items.forEach(item => {
            // Check page break (simplified)
            if (y < 50) {
                // Add new page if needed (not implemented for simplicity in this artifact)
            }

            drawText(item.description);
            page.drawText(`${item.quantity} ${item.unit}`, { x: width - 200, y, size: 10, font });
            page.drawText(`${item.pricePerUnit} kr`, { x: width - 130, y, size: 10, font });
            page.drawText(`${item.total} kr`, { x: width - margin - 40, y, size: 10, font });

            y -= 20;
            page.drawLine({ start: { x: margin, y: y + 10 }, end: { x: width - margin, y: y + 10 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
        });

        // --- TOTALS ---
        y -= 20;
        const totalX = width - 200;

        drawText('Delsumma (exkl. moms):', { x: totalX - 50 });
        drawText(`${input.totals.subtotal} kr`, { x: width - margin - 40 });
        y -= 20;

        drawText('Moms (25%):', { x: totalX - 50 });
        drawText(`${input.totals.vatAmount} kr`, { x: width - margin - 40 });
        y -= 20;

        if (input.totals.rotDeduction) {
            drawText('ROT-avdrag (30% arbetskostnad):', { x: totalX - 50, color: rgb(0, 0.6, 0.2) });
            drawText(`-${input.totals.rotDeduction} kr`, { x: width - margin - 40, color: rgb(0, 0.6, 0.2) });
            y -= 20;
        }

        page.drawLine({ start: { x: totalX - 50, y: y + 10 }, end: { x: width - margin, y: y + 10 }, thickness: 2, color: primaryColor });
        y -= 10;

        drawText('ATT BETALA:', { x: totalX - 50, size: 14, font: fontBold });
        drawText(`${input.totals.totalToPay} kr`, { x: width - margin - 40, size: 14, font: fontBold });

        // --- FOOTER ---
        const bottomY = 50;
        page.drawLine({ start: { x: margin, y: bottomY + 20 }, end: { x: width - margin, y: bottomY + 20 }, thickness: 1, color: grayColor });

        let footerX = margin;
        const footerStep = 150;

        drawText(input.contractor.name, { x: footerX, y: bottomY, size: 8, font: fontBold });
        drawText(`Org.nr: ${input.contractor.orgNumber}`, { x: footerX, y: bottomY - 12, size: 8 });
        if (input.contractor.website) drawText(input.contractor.website, { x: footerX, y: bottomY - 24, size: 8 });

        footerX += footerStep;
        if (input.contractor.bankgiro) drawText(`Bankgiro: ${input.contractor.bankgiro}`, { x: footerX, y: bottomY, size: 8 });
        if (input.contractor.plusgiro) drawText(`PlusGiro: ${input.contractor.plusgiro}`, { x: footerX, y: bottomY - 12, size: 8 });

        footerX += footerStep;
        if (input.contractor.swish) drawText(`Swish: ${input.contractor.swish}`, { x: footerX, y: bottomY, size: 8 });
        if (input.contractor.email) drawText(`Email: ${input.contractor.email}`, { x: footerX, y: bottomY - 12, size: 8 });

        page.drawText('Genererat av ByggPilot', { x: width - margin - 80, y: bottomY - 30, size: 6, color: grayColor });

        // --- SAVE ---
        const pdfBytes = await pdfDoc.save();

        // Upload
        let fileId = 'error';
        let webViewLink = 'error';

        if (input.targetFolderId) {
            try {
                const buffer = Buffer.from(pdfBytes);
                const stream = Readable.from(buffer);
                const uploadRes = await GoogleDriveService.uploadFile(
                    `Offert - ${input.project.name}.pdf`,
                    'application/pdf',
                    stream,
                    input.targetFolderId,
                    accessToken
                );
                fileId = uploadRes.id;
                webViewLink = uploadRes.webViewLink;
            } catch (error: any) {
                console.error("PDF Gen Upload Failed:", error);
                return { fileId: 'error', webViewLink: '', message: error.message };
            }
        } else {
            const base64Pdf = Buffer.from(pdfBytes).toString('base64');
            const dataUri = `data:application/pdf;base64,${base64Pdf}`;
            return {
                fileId: 'memory-only',
                webViewLink: dataUri,
                message: 'Offer PDF generated in memory (Not saved to Drive. Click link to download/view). To save permanently, ensure a Project is active.'
            };
        }

        return {
            fileId,
            webViewLink,
            message: `Offer PDF generated successfully for ${input.customer.name}`,
        };
    }
);
