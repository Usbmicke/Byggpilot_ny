import 'server-only';
import { ai } from '@/lib/genkit-instance';
import { z } from 'genkit';

export const webSearchTool = ai.defineTool(
    {
        name: 'webSearchTool',
        description: 'Searches the real internet (Google) for facts, regulations, or up-to-date information. Use this when you do not know the answer or need to verify a claim.',
        inputSchema: z.object({
            query: z.string().describe('The search query (e.g. "Prisbasbelopp 2025" or "AFS 2013:4 ställningar")'),
        }),
        outputSchema: z.string(),
    },
    async ({ query }) => {
        const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY;
        const cx = process.env.GOOGLE_CSE_ID;

        if (!apiKey || !cx) {
            console.warn("⚠️ Web Search attempted but keys (GOOGLE_GENAI_API_KEY, GOOGLE_CSE_ID) are missing.");
            return "SYSTEM_NOTE: Internet search is currently disabled/unconfigured. Please answer the user's question using your INTERNAL KNOWLEDGE and training data. Frame your answer as 'Branschpraxis' or 'Generella regler' and remind the user that you are referring to general standards since you couldn't verify online right now.";
        }

        console.log(`🌐 Googling (via fetch): "${query}"`);

        try {
            const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=3`;
            const response = await fetch(url);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Web Search API Error (${response.status}):`, errorText);
                return `SYSTEM_NOTE: Search failed (API Error: ${response.status}). Use formatting fallback (Praxis/General Rules).`;
            }

            const data = await response.json();

            if (!data.items || data.items.length === 0) {
                return "No results found on Google.";
            }

            // Format results for the AI
            const snippets = data.items.map((item: any) => {
                return `[TITLE]: ${item.title}\n[LINK]: ${item.link}\n[SNIPPET]: ${item.snippet}\n---`;
            }).join('\n');

            return `SEARCH RESULTS FOR "${query}":\n\n${snippets}`;

        } catch (error: any) {
            console.error("Web Search Network Error:", error);
            return `SYSTEM_NOTE: Search failed (Network Error). Use formatting fallback (Praxis/General Rules).`;
        }
    }
);
