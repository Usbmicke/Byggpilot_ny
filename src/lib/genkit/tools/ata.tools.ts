import 'server-only';
import { z } from 'genkit';
import { ai } from '@/lib/genkit-instance';
import { ChangeOrderRepo } from '@/lib/dal/ata.repo';
import { ProjectRepo } from '@/lib/dal/project.repo';

export const createChangeOrderTool = ai.defineTool(
    {
        name: 'createChangeOrder',
        description: 'Creates a Change Order (ÄTA) for a project. Use this when user wants to add extra work or materials.',
        inputSchema: z.object({
            projectId: z.string().describe('The ID of the project'),
            description: z.string().describe('Description of work/material'),
            quantity: z.number().describe('Quantity (e.g. hours or pieces)'),
            unit: z.string().describe('Unit (e.g. tim, st, m2)'),
            estimatedCost: z.number().describe('Estimated TOTAL cost ex VAT'),
            type: z.enum(['material', 'work', 'other']).describe('Type of expense')
        }),
        outputSchema: z.object({
            success: z.boolean(),
            id: z.string(),
            message: z.string()
        }),
    },
    async (input) => {
        try {
            console.log(`🔧 Tool: createChangeOrder for Project ${input.projectId}`);

            // Verify project exists
            const project = await ProjectRepo.get(input.projectId);
            if (!project) throw new Error(`Project ${input.projectId} not found.`);

            const ata = await ChangeOrderRepo.create({
                ...input,
                projectId: input.projectId,
                type: input.type as any
            });

            return {
                success: true,
                id: ata.id,
                message: `ÄTA skapad: ${input.description} (${input.estimatedCost} kr). Finns nu i utkast.`
            };
        } catch (e: any) {
            return { success: false, id: '', message: e.message };
        }
    }
);

// ... (existing exports)

import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import { GoogleDriveService } from '@/lib/google/drive';
import { Readable } from 'stream';
import { UserRepo } from '@/lib/dal/user.repo';
import { CompanyRepo } from '@/lib/dal/company.repo';

export const draftEmailTool = ai.defineTool(
    {
        name: 'draftEmail',
        description: 'Drafts an email to the customer. Use this to confirm ÄTAs.',
        inputSchema: z.object({
            recipientEmail: z.string(),
            subject: z.string(),
            body: z.string()
        }),
        outputSchema: z.string(),
    },
    async (input) => {
        // Create mailto link
        const subject = encodeURIComponent(input.subject);
        const body = encodeURIComponent(input.body);
        const mailtoLink = `mailto:${input.recipientEmail}?subject=${subject}&body=${body}`;

        return `[📧 Skicka E-post (Klicka här)](${mailtoLink})\n\n**Utkast:**\nTill: ${input.recipientEmail}\nÄmne: ${input.subject}\n${input.body}`;
    }
);

export const generateAtaPdfTool = ai.defineTool(
    {
        name: 'generateAtaPdf',
        description: 'Generates a PDF for a specific Change Order (ÄTA) and saves it to Project Drive (Folder 4_ÄTA).',
        inputSchema: z.object({
            ataId: z.string().describe('The ID of the ÄTA to generate PDF for'),
        }),
        outputSchema: z.object({
            success: z.boolean(),
            webViewLink: z.string().optional(),
            message: z.string()
        }),
    },
    async (input, context: any) => {
        try {
            console.log(`📄 Generating PDF for ÄTA: ${input.ataId}`);

            // 1. Fetch Data
            const ata = await ChangeOrderRepo.get(input.ataId);
            if (!ata) throw new Error("ATA not found");

            const project = await ProjectRepo.get(ata.projectId);
            if (!project) throw new Error("Project not found");

            // Context: Access Token
            const accessToken = context?.accessToken || context?.context?.accessToken as string | undefined;

            // 2. Resolve Drive Folder (4_ÄTA)
            if (!project.driveFolderId) throw new Error("Project has no Drive Folder connected. Cannot save PDF.");

            // Ensure '4_ÄTA' exists
            const ataFolderId = await GoogleDriveService.ensureFolderExists('4_ÄTA', project.driveFolderId, accessToken);

            // 3. fetch Company Info for Header
            let companyName = "Mitt Företag";
            if (project.ownerId) {
                const user = await UserRepo.get(project.ownerId);
                if (user?.companyId) {
                    const comp = await CompanyRepo.get(user.companyId);
                    if (comp) companyName = comp.profile?.name || comp.name || "Mitt Företag";
                }
            }

            // 4. Create PDF
            const pdfDoc = await PDFDocument.create();
            const page = pdfDoc.addPage([595.28, 841.89]); // A4
            const { width, height } = page.getSize();
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

            let y = height - 50;
            const margin = 50;

            const drawText = (text: string, size: number = 10, isBold: boolean = false, x: number = margin, color = rgb(0, 0, 0)) => {
                page.drawText(text, { x, y, size, font: isBold ? fontBold : font, color });
                y -= (size + 5);
            };

            // Header
            drawText('ÄNDRINGS- & TILLÄGGSARBETE (ÄTA)', 18, true);
            y -= 10;
            drawText(`Projekt: ${project.name}`, 12, false, margin, rgb(0.3, 0.3, 0.3));
            drawText(`Leverantör: ${companyName}`, 10, false, margin, rgb(0.3, 0.3, 0.3));
            drawText(`Datum: ${new Date().toISOString().split('T')[0]}`, 10, false, margin, rgb(0.3, 0.3, 0.3));

            y -= 40;

            // Content
            drawText('Beskrivning:', 12, true);
            const descLines = ata.description.match(/.{1,90}/g) || [ata.description];
            descLines.forEach((line: string) => drawText(line, 10));

            y -= 20;
            drawText('Detaljer:', 12, true);
            drawText(`Typ: ${ata.type === 'material' ? 'Material' : ata.type === 'work' ? 'Arbete' : 'Övrigt'}`);
            drawText(`Antal: ${ata.quantity} ${ata.unit}`);

            y -= 20;
            drawText('Kostnad:', 12, true);
            drawText(`Beräknat pris: ${ata.estimatedCost} kr (exkl. moms)`, 14, true);

            y -= 40;

            // Status Stamp
            if (ata.status === 'approved') {
                page.drawText('GODKÄND AV BESTÄLLARE', {
                    x: width - 200,
                    y: height - 150,
                    size: 14,
                    font: fontBold,
                    color: rgb(0, 0.6, 0.2),
                    rotate: degrees(-15)
                });
            }

            // Footer
            y = 50;
            page.drawText(`Genererad av ByggPilot ID: ${ata.id}`, { x: margin, y, size: 8, color: rgb(0.5, 0.5, 0.5) });

            // 5. Save & Upload
            const pdfBytes = await pdfDoc.save();
            const buffer = Buffer.from(pdfBytes);
            const stream = Readable.from(buffer);

            const uploadRes = await GoogleDriveService.uploadFile(
                `ÄTA - ${ata.description.substring(0, 20)}...pdf`,
                'application/pdf',
                stream,
                ataFolderId,
                accessToken
            );

            // SAVE LINK TO DB
            await ChangeOrderRepo.updatePdf(ata.id, uploadRes.id, uploadRes.webViewLink);

            return {
                success: true,
                webViewLink: uploadRes.webViewLink,
                message: `PDF sparad i mapp 4_ÄTA: ${uploadRes.webViewLink}`
            };

        } catch (error: any) {
            console.error("ATA PDF Failed:", error);
            return { success: false, message: error.message };
        }
    }
);
