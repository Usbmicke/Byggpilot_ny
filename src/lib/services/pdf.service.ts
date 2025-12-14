import 'server-only';
import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib';

/**
 * Shared Type Definitions for PDF Generation
 */
export interface PdfContractor {
    name: string;
    orgNumber: string;
    address: string;
    contact?: string;
    email?: string;
    phone?: string;
    website?: string;
    bankgiro?: string;
    plusgiro?: string;
    swish?: string;
}

export interface PdfCustomer {
    name: string;
    idNumber?: string; // OrgNr or PersonNr
    address: string;
    contact?: string;
}

export interface PdfItem {
    description: string;
    quantity: number;
    unit: string;
    pricePerUnit: number;
    total: number;
    vatRate?: number; // Usually 25% (0.25)
    isRotEligible?: boolean; // If true, labor cost
}

export interface PdfTotals {
    subtotal: number;
    vatAmount: number;
    rotDeduction?: number;
    totalToPay: number;
}

export interface PdfData {
    id: string; // Invoice Nr or Offer Nr
    date: string;
    projectTitle: string;
    contractor: PdfContractor;
    customer: PdfCustomer;
    items: PdfItem[];
    totals: PdfTotals;
    dueDate?: string; // For Invoices
    ocr?: string; // For Invoices
}

export const PdfService = {
    /**
     * Generates a Professional Offer PDF
     */
    async generateOffer(data: PdfData): Promise<Buffer> {
        return this._createGenericDocument('OFFERT', data, rgb(0.2, 0.2, 0.8));
    },

    /**
     * Generates a Professional Invoice PDF
     */
    async generateInvoice(data: PdfData): Promise<Buffer> {
        return this._createGenericDocument('FAKTURA', data, rgb(0, 0, 0)); // Black for formal invoice
    },

    /**
     * Internal generic generator for Offers and Invoices (Share standard layout)
     */
    async _createGenericDocument(docType: string, data: PdfData, primaryColor: any): Promise<Buffer> {
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([595.28, 841.89]); // A4
        const { width, height } = page.getSize();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const grayColor = rgb(0.5, 0.5, 0.5);

        let y = height - 50;
        const margin = 50;

        // Helper: Draw Text
        const drawText = (text: string, options: any = {}) => {
            page.drawText(text || '', {
                x: margin,
                y,
                size: 10,
                font: font,
                color: rgb(0, 0, 0),
                ...options
            });
        };

        // --- HEADER ---
        drawText(docType, { size: 24, font: fontBold, color: primaryColor });

        // Document Meta (Right side)
        const metaX = width - 200;
        let metaY = height - 50;

        page.drawText(`Nr:`, { x: metaX, y: metaY, size: 10, font: fontBold });
        page.drawText(data.id, { x: metaX + 60, y: metaY, size: 10, font });
        metaY -= 15;

        page.drawText(`Datum:`, { x: metaX, y: metaY, size: 10, font: fontBold });
        page.drawText(data.date, { x: metaX + 60, y: metaY, size: 10, font });
        metaY -= 15;

        if (data.dueDate) {
            page.drawText(`Förfallodatum:`, { x: metaX, y: metaY, size: 10, font: fontBold });
            page.drawText(data.dueDate, { x: metaX + 80, y: metaY, size: 10, font });
            metaY -= 15;
        }

        y -= 60; // Move down past header

        // --- PARTIES ---
        const startY = y;

        // Contractor (Left)
        drawText(data.contractor.name, { font: fontBold, size: 11 });
        y -= 15;
        drawText(data.contractor.address);
        y -= 15;
        drawText(`Org.nr: ${data.contractor.orgNumber}`);
        y -= 15;
        if (data.contractor.email) drawText(data.contractor.email);
        if (data.contractor.phone) {
            y -= 15;
            drawText(data.contractor.phone);
        }

        // Customer (Right)
        y = startY; // Reset Y
        const col2X = width / 2 + 20;

        page.drawText('Mottagare:', { x: col2X, y: y, size: 9, font: font, color: grayColor });
        y -= 15;
        page.drawText(data.customer.name, { x: col2X, y: y, size: 11, font: fontBold });
        y -= 15;
        page.drawText(data.customer.address, { x: col2X, y: y, size: 10, font: font });
        if (data.customer.idNumber) {
            y -= 15;
            page.drawText(`ID: ${data.customer.idNumber}`, { x: col2X, y: y, size: 10, font: font });
        }

        y = startY - 100;

        // --- PROJECT TITLE ---
        page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.9, 0.9, 0.9) });
        y -= 25;
        drawText('Avser Projekt:', { font: fontBold });
        drawText(data.projectTitle, { x: margin + 80 });
        y -= 30;

        // --- ITEMS TABLE ---
        // Header
        page.drawRectangle({ x: margin, y: y - 5, width: width - (margin * 2), height: 25, color: rgb(0.95, 0.95, 0.95) });
        drawText('Beskrivning', { y, font: fontBold });
        page.drawText('Antal', { x: width - 230, y, size: 10, font: fontBold }); // Widened
        page.drawText('A-pris', { x: width - 150, y, size: 10, font: fontBold });
        page.drawText('Belopp', { x: width - margin - 40, y, size: 10, font: fontBold }); // Right align-ish
        y -= 35;

        // Rows
        for (const item of data.items) {
            // Simple Page Break Check
            if (y < 100) {
                const newPage = pdfDoc.addPage([595.28, 841.89]);
                y = height - 50;
                // (Ideally we would re-draw headers here, but keeping it simple for MVP)
            }

            // Description truncation/wrap (Simple truncation for now)
            const desc = item.description.length > 55 ? item.description.substring(0, 52) + '...' : item.description;

            drawText(desc);
            page.drawText(`${item.quantity} ${item.unit}`, { x: width - 230, y, size: 10, font });
            page.drawText(`${item.pricePerUnit.toLocaleString('sv-SE')} kr`, { x: width - 150, y, size: 10, font });
            page.drawText(`${item.total.toLocaleString('sv-SE')} kr`, { x: width - margin - 40, y, size: 10, font });

            if (item.isRotEligible) {
                page.drawText('(ROT)', { x: width - margin, y, size: 8, font: font, color: grayColor });
            }

            y -= 20;
            page.drawLine({ start: { x: margin, y: y + 10 }, end: { x: width - margin, y: y + 10 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
        }

        // --- TOTALS ---
        y -= 20;
        const totalX = width - 250;

        // Subtotal
        drawText('Netto:', { x: totalX });
        drawText(`${data.totals.subtotal.toLocaleString('sv-SE')} kr`, { x: width - margin - 40 });
        y -= 20;

        // VAT
        drawText('Moms (25%):', { x: totalX });
        drawText(`${data.totals.vatAmount.toLocaleString('sv-SE')} kr`, { x: width - margin - 40 });
        y -= 20;

        // ROT
        if (data.totals.rotDeduction) {
            drawText('ROT-avdrag (30% arbete):', { x: totalX, color: rgb(0, 0.6, 0.2) });
            drawText(`-${data.totals.rotDeduction.toLocaleString('sv-SE')} kr`, { x: width - margin - 40, color: rgb(0, 0.6, 0.2) });
            y -= 25;
        }

        // Grand Total
        page.drawLine({ start: { x: totalX, y: y + 15 }, end: { x: width - margin, y: y + 15 }, thickness: 2, color: primaryColor });

        drawText('ATT BETALA:', { x: totalX, size: 14, font: fontBold });
        drawText(`${data.totals.totalToPay.toLocaleString('sv-SE')} kr`, { x: width - margin - 40, size: 14, font: fontBold });

        y -= 40;
        if (data.ocr) {
            page.drawRectangle({ x: margin, y: y, width: width - (margin * 2), height: 30, color: rgb(0.95, 0.95, 0.95), borderColor: rgb(0.8, 0.8, 0.8), borderWidth: 1 });
            drawText(`OCR / Referens: ${data.ocr}`, { x: margin + 10, y: y + 10, font: fontBold, size: 12 });
            y -= 20;
        }


        // --- FOOTER ---
        const bottomY = 50;
        page.drawLine({ start: { x: margin, y: bottomY + 25 }, end: { x: width - margin, y: bottomY + 25 }, thickness: 1, color: grayColor });

        let footerX = margin;
        const footerStep = 150;
        const footSize = 8;

        // Column 1
        page.drawText(data.contractor.name, { x: footerX, y: bottomY, size: footSize, font: fontBold });
        page.drawText(`Godkänd för F-skatt`, { x: footerX, y: bottomY - 12, size: footSize, font });
        page.drawText(`Org.nr: ${data.contractor.orgNumber}`, { x: footerX, y: bottomY - 24, size: footSize, font });

        footerX += footerStep;
        // Column 2
        if (data.contractor.bankgiro) page.drawText(`Bankgiro: ${data.contractor.bankgiro}`, { x: footerX, y: bottomY, size: footSize, font });
        if (data.contractor.plusgiro) page.drawText(`PlusGiro: ${data.contractor.plusgiro}`, { x: footerX, y: bottomY - 12, size: footSize, font });
        if (data.contractor.swish) page.drawText(`Swish: ${data.contractor.swish}`, { x: footerX, y: bottomY - 24, size: footSize, font });

        footerX += footerStep;
        // Column 3
        if (data.contractor.email) page.drawText(`${data.contractor.email}`, { x: footerX, y: bottomY, size: footSize, font });
        if (data.contractor.website) page.drawText(`${data.contractor.website}`, { x: footerX, y: bottomY - 12, size: footSize, font });

        page.drawText('Genererat av ByggPilot 2.0', { x: width - margin - 80, y: bottomY - 30, size: 6, color: grayColor });

        const pdfBytes = await pdfDoc.save();
        return Buffer.from(pdfBytes);
    }
};
