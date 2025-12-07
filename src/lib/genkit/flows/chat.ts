import 'server-only';
import { ai } from '@/lib/genkit-instance';
import { z } from 'genkit';
import { startProjectTool } from '../tools/project.tools';
import { AI_MODELS, AI_CONFIG } from '../config';

// Simple Message Schema
const MessageSchema = z.object({
    role: z.enum(['user', 'model', 'system']),
    content: z.string(),
});

const ChatInput = z.object({
    messages: z.array(MessageSchema),
});



// ... existing schema code ...

export const chatFlow = ai.defineFlow(
    {
        name: 'chatFlow',
        inputSchema: ChatInput,
        outputSchema: z.string(),
    },
    async (input) => {
        // Optimize Context: Keep only last N messages to save tokens and prevent context overflow
        const recentMessages = input.messages.slice(-AI_CONFIG.maxHistory);

        // Ensure System message is always present/re-injected if we cut it off? 
        // Actually, we are building the prompt manually below, so we just use recentMessages.

        const systemPrompt = `System: You are ByggPilot Co-Pilot, a helpful AI assistant for Swedish construction projects. 
        Current Date: ${new Date().toLocaleDateString('sv-SE')}.
        Role: Act as a senior construction project manager. Be concise, professional, and safety-conscious.
        Language: Answer in Swedish unless asked otherwise.`;

        const { text } = await ai.generate({
            prompt: `${systemPrompt}\n\n` + recentMessages.map(m => `${m.role}: ${m.content}`).join('\n'),
            model: AI_MODELS.FAST,
            config: {
                temperature: AI_CONFIG.temperature.creative,
            },
            tools: [startProjectTool],
        });

        return text;
    }
);


