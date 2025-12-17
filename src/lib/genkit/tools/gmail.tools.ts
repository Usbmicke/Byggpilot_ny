import 'server-only';
import { z } from 'genkit';
import { ai } from '@/lib/genkit-instance';
import { GmailService } from '@/lib/google/gmail';

export const readEmailTool = ai.defineTool(
    {
        name: 'readEmail',
        description: 'Reads the latest unread emails from the user\'s inbox. Use this when the user asks to "check email" or "read latest mails".',
        inputSchema: z.object({
            limit: z.number().optional().describe('Number of emails to fetch (default 5)'),
        }),
        outputSchema: z.object({
            success: z.boolean(),
            emails: z.array(z.object({
                from: z.string(),
                subject: z.string(),
                snippet: z.string(),
                id: z.string()
            })),
            error: z.string().optional()
        }),
    },
    async (input, context) => {
        const token = (context as any).context?.accessToken;
        if (!token) return { success: false, emails: [], error: "Saknar behörighet (Google Token)." };

        try {
            console.log(`📧 Reading emails (Limit: ${input.limit || 5})`);
            const emails = await GmailService.listUnreadEmails(token, input.limit || 5);

            return {
                success: true,
                emails: emails.map(e => ({
                    from: e.from,
                    subject: e.subject,
                    snippet: e.snippet || '',
                    id: e.id || ''
                }))
            };
        } catch (e: any) {
            console.error("Read Email Failed", e);
            return { success: false, emails: [], error: `Kunde inte läsa mail: ${e.message}` };
        }
    }
);

// NEW SAFETY TOOL: Preview Only
export const previewEmailTool = ai.defineTool(
    {
        name: 'previewEmail',
        description: 'MANDATORY STEP 1: Drafts an email for user review. Call this BEFORE sendEmail. Returns the content for display.',
        inputSchema: z.object({
            to: z.string(),
            subject: z.string(),
            body: z.string(),
        }),
        outputSchema: z.string(),
    },
    async (input) => {
        return `✅ **EMAIL DRAFT CREATED**\n\n**To:** ${input.to}\n**Subject:** ${input.subject}\n\n${input.body}\n\n---\n*System: User must reply "JA" or "SKICKA" to proceed.*`;
    }
);

export const sendEmailTool = ai.defineTool(
    {
        name: 'sendEmail',
        description: 'MANDATORY STEP 2: Sends the email. ONLY use this AFTER the user has explicitly confirmed the draft from previewEmail.',
        inputSchema: z.object({
            to: z.string().email(),
            subject: z.string(),
            body: z.string().describe('HTML body of the email'),
            threadId: z.string().optional().describe('Thread ID to reply to existing conversation'),
        }),
        outputSchema: z.object({
            success: z.boolean(),
            messageId: z.string().optional(),
            error: z.string().optional()
        }),
    },
    async (input, context) => {
        const token = (context as any).context?.accessToken;
        if (!token) return { success: false, messageId: undefined, error: "Saknar behörighet (Google Token)." };

        try {
            console.log(`📧 Sending email to ${input.to} (Thread: ${input.threadId || 'New'})`);
            // Anti-Hallucination Check: If body contains "sen" or "late", warn the system logs (cannot stop it here easily without complex regex, but good for debugging)
            if (input.body.toLowerCase().includes('jag kan bli sen') || input.body.toLowerCase().includes('15 min')) {
                console.warn("⚠️ AI tried to send 'late' excuse. This should have been caught in Draft.");
            }

            const res = await GmailService.sendEmail(token, input.to, input.subject, input.body, input.threadId);
            return { success: true, messageId: res.id || undefined };
        } catch (e: any) {
            console.error("Send Email Failed", e);
            return { success: false, error: `Kunde inte skicka mail: ${e.message}` };
        }
    }
);
