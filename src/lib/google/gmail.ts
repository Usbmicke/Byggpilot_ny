import 'server-only';
import { google } from 'googleapis';

export const GmailService = {
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

                return { id, subject, from, snippet, body: snippet }; // Using snippet as body proxy for efficiency
            })
        );

        return emails;
    },

    async sendEmail(accessToken: string, to: string, subject: string, body: string) {
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token: accessToken });
        const gmail = google.gmail({ version: 'v1', auth });

        // Create email content
        const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
        const messageParts = [
            `To: ${to}`,
            'Content-Type: text/html; charset=utf-8',
            'MIME-Version: 1.0',
            `Subject: ${utf8Subject}`,
            '',
            body,
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
                raw: encodedMessage,
            },
        });

        return res.data;
    }
};
