import 'server-only'; // Kritiskt! Stoppar koden från att läcka till klienten
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';

// Starta telemetri för debugging (valfritt men bra)
enableFirebaseTelemetry();

// Flows imports to ensure registration
// Flows imports to ensure registration
import './genkit/flows/onboarding';
import './genkit/flows/chat';
import './genkit/tools/project.tools';
import './genkit/tools/calculation.tools';
import './genkit/tools/pdf.tools';
import './genkit/tools/vision.tools';

export const ai = genkit({
  plugins: [googleAI()],
});
