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

export const sendEmailTool = ai.defineTool(
    {
        name: 'sendEmail',
        description: 'Sends an email to a recipient. Use this when the user approves a draft or explicitly asks to send an email.',
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
            const res = await GmailService.sendEmail(token, input.to, input.subject, input.body, input.threadId);
            return { success: true, messageId: res.id || undefined };
        } catch (e: any) {
            console.error("Send Email Failed", e);
            return { success: false, error: `Kunde inte skicka mail: ${e.message}` };
        }
    }
);
