import handleGenkit from '@genkit-ai/next';
import { ai } from '@/lib/genkit';

export const GET = handleGenkit(ai as any);
export const POST = handleGenkit(ai as any);
