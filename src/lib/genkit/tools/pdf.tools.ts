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
        // const smallFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique); // Unused

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

        // 3. Upload to Drive
        let fileId = 'error';
        let webViewLink = 'error';

        if (finalFolderId) {
            try {
                // Convert Uint8Array to Buffer to Stream
                const buffer = Buffer.from(pdfBytes);
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

// --- NEW PDF SERVICE INTEGRATION ---

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
        idNumber: z.string().optional(),
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
        isRotEligible: z.boolean().optional(),
    })),
    totals: z.object({
        subtotal: z.number(),
        vatAmount: z.number(),
        rotDeduction: z.number().optional(),
        totalToPay: z.number(),
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
        const accessToken = context?.accessToken || context?.context?.accessToken as string | undefined;

        try {
            const { PdfService } = await import('@/lib/services/pdf.service');

            // Map Input to PdfData
            const pdfData: any = { // using any to bypass strict type check for now, but structure matches
                id: "UTKAST", // Offer Number generator not yet implemented
                date: new Date().toLocaleDateString('sv-SE'),
                projectTitle: input.project.name,
                contractor: input.contractor,
                customer: input.customer,
                items: input.items,
                totals: input.totals
            };

            const pdfBuffer = await PdfService.generateOffer(pdfData);

            // Upload
            if (input.targetFolderId) {
                const { Readable } = await import('stream');
                const stream = Readable.from(pdfBuffer);
                const uploadRes = await GoogleDriveService.uploadFile(
                    `Offert - ${input.project.name}.pdf`,
                    'application/pdf',
                    stream,
                    input.targetFolderId,
                    accessToken
                );
                return {
                    fileId: uploadRes.id,
                    webViewLink: uploadRes.webViewLink,
                    message: `Offer generated: ${uploadRes.webViewLink}`
                };
            } else {
                const base64Pdf = pdfBuffer.toString('base64');
                const dataUri = `data:application/pdf;base64,${base64Pdf}`;
                return {
                    fileId: 'memory-only',
                    webViewLink: dataUri,
                    message: `Offer PDF generated (memory only). [Link](${dataUri})`
                };
            }
        } catch (e: any) {
            console.error("Generate Offer Tool Failed:", e);
            return {
                fileId: 'error',
                webViewLink: '',
                message: `Failed to generate offer: ${e.message}`
            };
        }
    }
);

export const generateInvoiceTool = ai.defineTool(
    {
        name: 'generateInvoice',
        description: 'Generates a professional Invoice PDF (Slutfaktura) and saves it to Google Drive. Calculates ROT automatically if applicable.',
        inputSchema: OfferInput.extend({
            invoiceNumber: z.string().default("UTKAST"),
            dueDate: z.string().optional(),
            ocr: z.string().optional(),
        }),
        outputSchema: z.object({
            fileId: z.string(),
            webViewLink: z.string(),
            message: z.string(),
        }),
    },
    async (input, context: any) => {
        console.log(`[Tool: generateInvoice] Creating Invoice for ${input.customer.name}`);
        const accessToken = context?.accessToken || context?.context?.accessToken as string | undefined;

        try {
            const { PdfService } = await import('@/lib/services/pdf.service');

            // Map Input to PdfData
            const pdfData: any = {
                id: input.invoiceNumber,
                date: new Date().toLocaleDateString('sv-SE'),
                projectTitle: input.project.name,
                contractor: input.contractor,
                customer: input.customer,
                items: input.items,
                totals: input.totals,
                dueDate: input.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE'), // Default 30 days
                ocr: input.ocr
            };

            const pdfBuffer = await PdfService.generateInvoice(pdfData);

            // Upload
            if (input.targetFolderId) {
                const { Readable } = await import('stream');
                const stream = Readable.from(pdfBuffer);
                const uploadRes = await GoogleDriveService.uploadFile(
                    `Faktura - ${input.project.name}.pdf`,
                    'application/pdf',
                    stream,
                    input.targetFolderId,
                    accessToken
                );
                return {
                    fileId: uploadRes.id,
                    webViewLink: uploadRes.webViewLink,
                    message: `Invoice generated: ${uploadRes.webViewLink}`
                };
            } else {
                const base64Pdf = pdfBuffer.toString('base64');
                const dataUri = `data:application/pdf;base64,${base64Pdf}`;
                return {
                    fileId: 'memory-only',
                    webViewLink: dataUri,
                    message: `Invoice PDF generated (memory only). [Link](${dataUri})`
                };
            }
        } catch (e: any) {
            console.error("Generate Invoice Tool Failed:", e);
            return {
                fileId: 'error',
                webViewLink: '',
                message: `Failed to generate invoice: ${e.message}`
            };
        }
    }
);
export const finalizeDocToPdfTool = ai.defineTool(
    {
        name: 'finalizeDocToPdf',
        description: 'Finalizes a "Living Document" (Google Doc) by exporting it to PDF, saving it to Drive, and renaming the original Doc to "[LÅST]...". Use this when a document cycle is complete (e.g. Project Done).',
        inputSchema: z.object({
            sourceDocId: z.string().describe("The Google Drive ID of the source Google Doc."),
            targetFolderId: z.string().optional().describe("Where to save the PDF. Defaults to same as source if possible, or root."),
            newName: z.string().optional().describe("Name of the final PDF. Defaults to Doc name."),
        }),
        outputSchema: z.object({
            pdfFileId: z.string(),
            pdfLink: z.string(),
            message: z.string()
        }),
    },
    async (input, context: any) => {
        const accessToken = context?.accessToken || context?.context?.accessToken as string | undefined;
        try {
            const { GoogleDriveService } = await import('@/lib/google/drive');

            // 1. Export content
            const { buffer } = await GoogleDriveService.exportPdf(input.sourceDocId, accessToken);
            const { Readable } = await import('stream');
            const stream = Readable.from(buffer);

            // 2. Upload PDF
            const pdfName = input.newName ? (input.newName.endsWith('.pdf') ? input.newName : `${input.newName}.pdf`) : `Finalized_Doc.pdf`; // fallback

            // Note: We might need to fetch the Doc metadata to get real name if newName isn't passed, but for now we assume input.

            const uploadRes = await GoogleDriveService.uploadFile(
                pdfName,
                'application/pdf',
                stream,
                input.targetFolderId,
                accessToken
            );

            // 3. Rename Original Doc
            await GoogleDriveService.renameFolder(input.sourceDocId, `[LÅST] ${input.newName || 'Original Doc'}`, accessToken);

            return {
                pdfFileId: uploadRes.id,
                pdfLink: uploadRes.webViewLink,
                message: `Document finalized! PDF saved: ${uploadRes.webViewLink}`
            };

        } catch (e: any) {
            console.error("Finalize Doc Failed:", e);
            return {
                pdfFileId: 'error',
                pdfLink: '',
                message: `Finalization failed: ${e.message}`
            };
        }
    }
);
