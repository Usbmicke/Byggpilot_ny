import 'server-only';
import { google } from 'googleapis';

export const GmailService = {
    /**
     * Get User Profile (email address)
     */
    async getProfile(accessToken: string) {
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: accessToken });
        const gmail = google.gmail({ version: 'v1', auth });
        const res = await gmail.users.getProfile({ userId: 'me' });
        return res.data;
    },

    /**
     * List unread messages from the last 2 days.
     */
    async listUnreadEmails(accessToken: string, limit = 10) {
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: accessToken });

        const gmail = google.gmail({ version: 'v1', auth });

        // Calculate date query (e.g., after:2023/10/01)
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        const dateQuery = `after:${twoDaysAgo.getFullYear()}/${twoDaysAgo.getMonth() + 1}/${twoDaysAgo.getDate()}`;

        // Get list of message IDs
        const response = await gmail.users.messages.list({
            userId: 'me',
            q: `is:unread ${dateQuery} -category:promotions -category:social -category:forums -category:updates -is:spam`, // Stricter filtering
            maxResults: limit,
        });

        if (!response.data.messages) return [];

        // Fetch full content for each
        const emails = await Promise.all(
            response.data.messages.map(async (msg) => {
                const fullMsg = await gmail.users.messages.get({
                    userId: 'me',
                    id: msg.id!,
                    format: 'full',
                });

                const headers = fullMsg.data.payload?.headers;
                const subject = headers?.find(h => h.name === 'Subject')?.value || 'No Subject';
                const from = headers?.find(h => h.name === 'From')?.value || 'Unknown';
                const snippet = fullMsg.data.snippet;
                const id = msg.id;

                const threadId = msg.threadId;

                return { id, threadId, subject, from, snippet, body: snippet }; // Using snippet as body proxy for efficiency
            })
        );

        return emails;
    },

    async sendEmail(accessToken: string, to: string, subject: string, body: string, attachmentsOrThreadId?: string | { filename: string, content: Buffer }[], potentialThreadId?: string) {
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: accessToken });
        const gmail = google.gmail({ version: 'v1', auth });

        // Arg parsing for backward compatibility
        let threadId: string | undefined = undefined;
        let attachments: { filename: string, content: Buffer }[] = [];

        if (typeof attachmentsOrThreadId === 'string') {
            threadId = attachmentsOrThreadId;
        } else if (Array.isArray(attachmentsOrThreadId)) {
            attachments = attachmentsOrThreadId;
            if (potentialThreadId) threadId = potentialThreadId;
        }

        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
        const boundary = "foo_bar_baz";

        // Logic Branch: Attachments vs Simple
        let encodedMessage = '';

        if (attachments.length > 0) {
            // MULTIPART
            let messageParts = [
                `To: ${to}`,
                `Subject: ${utf8Subject}`,
                `MIME-Version: 1.0`,
                `Content-Type: multipart/mixed; boundary="${boundary}"`,
                ``,
                `--${boundary}`,
                `Content-Type: text/html; charset=utf-8`,
                ``,
                body,
                ``
            ];

            // Add Attachments
            attachments.forEach(att => {
                messageParts.push(`--${boundary}`);
                messageParts.push(`Content-Type: application/pdf; name="${att.filename}"`);
                messageParts.push(`Content-Disposition: attachment; filename="${att.filename}"`);
                messageParts.push(`Content-Transfer-Encoding: base64`);
                messageParts.push(``);
                messageParts.push(att.content.toString('base64'));
                messageParts.push(``);
            });

            messageParts.push(`--${boundary}--`);

            // Headers are inside the body for multipart, but we need standard headers for the 'raw' wrapper?
            // Actually, the whole things IS the raw message.
            if (threadId) {
                // In multipart, In-Reply-To/References should be in the top headers block
                // Insert after Subject
                // We rely on 'threadId' param in API, but explicit headers help clients.
                messageParts.splice(2, 0, `In-Reply-To: <${threadId}@mail.gmail.com>`);
                messageParts.splice(3, 0, `References: <${threadId}@mail.gmail.com>`);
            }

            const message = messageParts.join('\n');
            encodedMessage = Buffer.from(message)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

        } else {
            // SIMPLE (Text/HTML)
            const headers = [
                `To: ${to}`,
                'Content-Type: text/html; charset=utf-8',
                'MIME-Version: 1.0',
                `Subject: ${utf8Subject}`,
            ];

            if (threadId) {
                headers.push(`In-Reply-To: <${threadId}@mail.gmail.com>`);
                headers.push(`References: <${threadId}@mail.gmail.com>`);
            }

            headers.push(''); // Empty line
            headers.push(body);

            const message = headers.join('\n');
            encodedMessage = Buffer.from(message)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');
        }

        const requestBody: any = {
            raw: encodedMessage,
        };

        if (threadId) {
            requestBody.threadId = threadId;
        }

        const res = await gmail.users.messages.send({
            userId: 'me',
            requestBody,
        });

        return res.data;
    }
};
