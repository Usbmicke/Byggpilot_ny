'use server';

import { InvoiceService } from '@/lib/services/invoice.service';

// Note: accessToken is passed from client component which gets it from AuthProvider

export async function prepareDraftAction(projectId: string, accessToken: string) {
    try {
        // Fix: Convert empty string to undefined so Drive Service uses Service Account fallback
        const safeToken = accessToken ? accessToken : undefined;
        const result = await InvoiceService.prepareDraft(projectId, undefined, false, safeToken);
        return { ...result, success: true };
    } catch (e: any) {
        return { success: false, message: e.message, warnings: [], link: "", id: "" };
    }
}


export async function finalizeInvoiceAction(input: any, accessToken: string) {
    try {
        const safeToken = accessToken ? accessToken : undefined;
        const result = await InvoiceService.finalizeInvoice(input, safeToken);
        return { ...result, success: true };
    } catch (e: any) {
        return { success: false, message: e.message, pdfLink: "" };
    }
}
