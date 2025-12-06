import 'server-only';
import { ai } from '@/lib/genkit-instance';
import { z } from 'genkit';
import { startProjectTool } from '../tools/project.tools';

// Simple Message Schema
const MessageSchema = z.object({
    role: z.enum(['user', 'model', 'system']),
    content: z.string(),
});

const ChatInput = z.object({
    messages: z.array(MessageSchema),
});

export const chatFlow = ai.defineFlow(
    {
        name: 'chatFlow',
        inputSchema: ChatInput,
        outputSchema: z.string(),
        // authPolicy: firebaseAuth((user) => { ... }), 
        // tools: [startProjectTool], // Config mismatch
    },
    async (input) => {
        const { text } = await ai.generate({
            prompt: `System: You are ByggPilot Co-Pilot, a helpful AI assistant for Swedish construction projects. Today is ${new Date().toLocaleDateString('sv-SE')}. Answer in Swedish unless asked otherwise.\n\n` + input.messages.map(m => `${m.role}: ${m.content}`).join('\n'),
            model: 'googleai/gemini-2.5-flash',
            config: {
                temperature: 0.7,
            },
            tools: [startProjectTool],
        });

        return text;
    }
);


