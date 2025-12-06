import 'server-only';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';

// Starta telemetri
// enableFirebaseTelemetry();

// Create the AI instance (Singleton)
export const ai = genkit({
    plugins: [googleAI()],
});
