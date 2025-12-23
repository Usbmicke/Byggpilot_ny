import 'server-only';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';
import { mockModel } from './genkit/mocks'; // Register Mock Model

// Starta telemetri
// enableFirebaseTelemetry();

// Create the AI instance (Singleton)
export const ai = genkit({
    plugins: [googleAI({
        apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY
    })],
    // Explicitly add models if needed, but defineModel registers globally.
    // However, clean is to not rely on side-effects if possible, but Genkit works by registry.
});
