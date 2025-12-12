import 'server-only';
import { ai } from '@/lib/genkit-instance';
import { z } from 'genkit';
import { ProjectRepo } from '@/lib/dal/project.repo';

const UpdateProjectInput = z.object({
    projectId: z.string().describe('The ID of the project to update'),
    description: z.string().optional().describe('New or appended description'),
    status: z.enum(['active', 'completed', 'paused', 'archived']).optional(),
    appendDescription: z.boolean().default(true).describe('If true, appends to existing description. If false, overwrites.'),
});

export const updateProjectTool = ai.defineTool(
    {
        name: 'updateProject',
        description: 'Updates an existing project. Use this to add details (e.g. "We are also doing the roof") or change status.',
        inputSchema: UpdateProjectInput,
        outputSchema: z.object({
            success: z.boolean(),
            message: z.string(),
        }),
    },
    async (input, context: any) => {
        console.log(`[Tool: updateProject] Updating ${input.projectId}`);

        try {
            const project = await ProjectRepo.get(input.projectId);
            if (!project) return { success: false, message: 'Project not found' };

            const updates: any = {};
            if (input.status) updates.status = input.status;

            if (input.description) {
                if (input.appendDescription && project.description) {
                    updates.description = project.description + '\n' + input.description;
                } else {
                    updates.description = input.description;
                }
            }

            await ProjectRepo.update(input.projectId, updates);

            return {
                success: true,
                message: `Project ${project.name} updated.`,
            };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    }
);
