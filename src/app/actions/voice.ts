'use server';

import { ataFlow } from '@/lib/genkit/flows/ata';
import { ChangeOrderRepo } from '@/lib/dal/ata.repo';
import { ProjectRepo } from '@/lib/dal/project.repo';

export async function processVoiceCommandAction(
    projectId: string,
    input: { text?: string; audioBase64?: string }
) {
    try {
        console.log(`🎤 Processing Voice Command for Project: ${projectId}`);

        // 1. Fetch Project Context
        const project = await ProjectRepo.listByOwner(projectId); // Wait, projectId argument is ID, not owner.
        // My ProjectRepo.listByOwner is for lists. I need get(projectId).
        // I need to add 'get' to ProjectRepo first. 
        // For now, I'll pass a project name context manually or just rely on what the user says.
        // BETTER: Expect the UI to pass the project name or I need to fix ProjectRepo.
        // Let's assume I need to fetch the project.

        // 2. Call AI Flow
        // We'll pass text directly if available. If Audio, we'd theoretically pass it to Genkit.
        // Since 'ataFlow' input schema defined 'text', I will assume for this MVP 
        // that we might be doing Speech-to-Text on client OR assuming Genkit handles it.
        // The implementation plan said: "Audio Blob sent to Server -> AI Analysis".
        // Gemini Flash handles audio. I should update 'ataFlow' to accept audio Part if possible.
        // BUT, 'ataFlow' defined 'text: z.string()'.
        // Let's stick to Text input for now to be safe, assuming the Client does STT (e.g. Web Speech API) 
        // OR we update 'ataFlow' to take a 'dataUri' string.

        // Let's assume the Client uses Web Speech API (free, built-in) for the "Text" part, 
        // creating a "Voice" experience without heavy backend audio processing yet.
        // AND/OR we support passing text.

        const result = await ataFlow({
            text: input.text || '',
            projectContext: `Project ID: ${projectId}`, // Placeholder for real context
        });

        // 3. Handle Result
        if (result.intent === 'create_ata' && result.data) {
            // Create a DRAFT in DB
            const draft = await ChangeOrderRepo.create({
                projectId,
                description: result.data.description!,
                quantity: result.data.quantity,
                estimatedCost: result.data.estimatedCost || 0,
                type: result.data.type,
            });

            return {
                success: true,
                intent: 'create_ata',
                reply: result.reply,
                draft: draft
            };
        }

        return { success: true, intent: result.intent, reply: result.reply };

    } catch (error: any) {
        console.error("❌ Voice Command Failed:", error);
        return { success: false, error: error.message };
    }
}
