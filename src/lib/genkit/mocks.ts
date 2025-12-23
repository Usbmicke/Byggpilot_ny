import 'server-only';
import { defineModel, GenerationCommonConfigSchema } from 'genkit/model';

export const mockModel = defineModel({
    name: 'mock-free',
    label: 'Mock Model (Free)',
    configSchema: GenerationCommonConfigSchema,
}, async (input: any) => {
    const lastMsg = input.messages[input.messages.length - 1];
    const query = lastMsg?.content?.[0]?.text || "(No text)";

    return {
        content: [{
            text: `[🤖 MOCK MODE] I received your message: "${query.substring(0, 50)}...". \n\nI cannot think or use tools in this mode, but I confirm the system is running/connected.`
        }],
        finishReason: 'stop',
        usage: { inputTokens: 5, outputTokens: 30, totalTokens: 35 }
    };
});
