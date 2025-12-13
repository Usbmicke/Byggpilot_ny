import 'server-only';
import { ai } from '@/lib/genkit-instance';
import { z } from 'genkit';
import { GoogleDriveService } from '@/lib/google/drive';

export const createDocDraftTool = ai.defineTool(
    {
        name: 'createDocDraft',
        description: 'Creates a Google Doc draft from HTML content. Use this for "living documents" like AMP (Work Environment Plan), Initial Offers, or Meeting Minutes that need user editing before final PDF generation. Returns a link to the editable document.',
        inputSchema: z.object({
            title: z.string().describe("The filename of the Google Doc, e.g. 'Utkast - AMP - Projekt X'"),
            htmlContent: z.string().describe("The content of the document in HTML format. Use <h1>, <h2>, <p>, <ul>, <li>, <table> etc."),
            folderId: z.string().optional().describe("Target Google Drive folder ID. If not provided, saves in Root/Unorganized."),
        }),
        outputSchema: z.object({
            fileId: z.string(),
            link: z.string(),
            message: z.string(),
        }),
    },
    async (input, context: any) => {
        // Handle nested context from Genkit
        const accessToken = context?.accessToken || context?.context?.accessToken as string | undefined;
        console.log(`[Tool: createDocDraft] Creating ${input.title}`);

        try {
            const res = await GoogleDriveService.createGoogleDoc(input.title, input.htmlContent, input.folderId, accessToken);
            return {
                fileId: res.id,
                link: res.webViewLink,
                message: `Utkast skapat! Du kan redigera det här: ${res.webViewLink}`
            };
        } catch (e: any) {
            console.error("Failed to create Doc Draft:", e);
            return {
                fileId: 'error',
                link: '',
                message: `Kunde inte skapa utkast: ${e.message}`
            };
        }
    }
);

export const appendDocTool = ai.defineTool(
    {
        name: 'appendDoc',
        description: 'Appends text to the end of an existing Google Doc. Use this to update "living documents" like AMP (Work Environment Plan) with new risks or info.',
        inputSchema: z.object({
            fileId: z.string().describe("The Google Drive File ID of the document."),
            textContent: z.string().describe("The text content to append."),
        }),
        outputSchema: z.object({
            success: z.boolean(),
            message: z.string(),
        }),
    },
    async (input, context: any) => {
        const accessToken = context?.accessToken || context?.context?.accessToken as string | undefined;
        try {
            await GoogleDriveService.appendContentToDoc(input.fileId, input.textContent, accessToken);
            return { success: true, message: "Dokumentet uppdaterat!" };
        } catch (e: any) {
            console.error("Failed to append doc:", e);
            return { success: false, message: `Update failed: ${e.message}` };
        }
    }
);
