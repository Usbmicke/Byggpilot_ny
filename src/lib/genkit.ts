import 'server-only'; // Kritiskt! Stoppar koden från att läcka till klienten
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';

// Starta telemetri för debugging (valfritt men bra)
enableFirebaseTelemetry();

// Flows imports to ensure registration
import './flows/onboarding';
import './flows/chat';
import './tools/project.tools';
import './tools/calculation.tools';
import './tools/pdf.tools';
import './tools/vision.tools';

export const ai = genkit({
  plugins: [googleAI()],
});
