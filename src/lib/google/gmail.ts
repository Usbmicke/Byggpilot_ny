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

    async sendEmail(accessToken: string, to: string, subject: string, body: string, threadId?: string) {
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: accessToken });
        const gmail = google.gmail({ version: 'v1', auth });

        // Create email content
        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
        const headers = [
            `To: ${to}`,
            'Content-Type: text/html; charset=utf-8',
            'MIME-Version: 1.0',
            `Subject: ${utf8Subject}`,
        ];

        if (threadId) {
            headers.push(`In-Reply-To: <${threadId}@mail.gmail.com>`); // Best effort, usually requires actual Message-ID of parent
            headers.push(`References: <${threadId}@mail.gmail.com>`); // Simplification. For robust threading we need the parent Message-ID.
            // Ideally we should fetch the thread logic here, but for now we try to just associate it via threadId in the API call object.
        }

        headers.push(''); // Empty line before body
        headers.push(body);

        const message = headers.join('\n');
        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

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
    },

    async sendEmailWithAttachment(accessToken: string, to: string, subject: string, body: string, attachment: { filename: string, content: Buffer }) {
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: accessToken });
        const gmail = google.gmail({ version: 'v1', auth });

        const boundary = "foo_bar_baz";
        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;

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
            ``,
            `--${boundary}`,
            `Content-Type: application/pdf; name="${attachment.filename}"`,
            `Content-Disposition: attachment; filename="${attachment.filename}"`,
            `Content-Transfer-Encoding: base64`,
            ``,
            attachment.content.toString('base64'),
            ``,
            `--${boundary}--`
        ];

        const message = messageParts.join('\n');
        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        const res = await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage
            }
        });

        return res.data;
    }
};
