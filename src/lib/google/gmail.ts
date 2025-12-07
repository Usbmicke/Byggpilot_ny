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
            q: `is:unread ${dateQuery} category:primary -is:spam -is:promotions -is:social`, // Strict filtering to save AI costs
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
    }
};
