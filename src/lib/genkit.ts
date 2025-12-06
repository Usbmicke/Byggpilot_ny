import 'server-only';
export * from './genkit-instance';

// Flows imports to ensure registration
// These files now import 'ai' from './genkit-instance', breaking the cycle.
import './genkit/flows/onboarding';
import './genkit/flows/chat';
import './genkit/tools/project.tools';
import './genkit/tools/calculation.tools';
import './genkit/tools/pdf.tools';
import './genkit/tools/vision.tools';
