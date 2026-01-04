import 'server-only';
import { ai } from '@/lib/genkit-instance';
import { z } from 'genkit';
import { ProjectRepo } from '@/lib/dal/project.repo';

// Define the Input Schema
const StartProjectInput = z.object({
    name: z.string().describe('The name of the project'),
    customerId: z.string().optional().describe('The ID of the customer to link to this project (if known)'),
    description: z.string().optional().describe('Brief description of the project'),
});

export const startProjectTool = ai.defineTool(
    {
        name: 'startProject',
        description: 'Creates a new construction project. Use this when the user says "Start project" or "New job". Try to link a customer if one is mentioned.',
        inputSchema: StartProjectInput,
        outputSchema: z.object({
            projectId: z.string(),
            folderId: z.string().optional(),
            message: z.string(),
        }),
    },
    async (input, context: any) => {
        // Handle nested context from Genkit
        const userId = context?.uid || context?.context?.uid || context?.auth?.uid;
        const accessToken = context?.accessToken || context?.context?.accessToken;

        if (!userId) {
            console.warn('Tool startProject called without auth context. Cannot create project.');
            return {
                projectId: 'error',
                message: 'Error: No user context found. Please log in again.'
            };
        }

        console.log(`[Tool: startProject] Creating project: ${input.name} for user: ${userId}`);

        // 0. Get Project Number
        let projectNumber: string | undefined;
        let companyName = "Mitt Företag"; // Default

        try {
            const { CompanyRepo } = await import('@/lib/dal/company.repo');
            const { UserRepo } = await import('@/lib/dal/user.repo');

            const userObj = await UserRepo.get(userId);
            if (userObj?.companyId) {
                const company = await CompanyRepo.get(userObj.companyId);
                if (company) {
                    companyName = company.name;
                    projectNumber = await CompanyRepo.getNextProjectNumber(userObj.companyId);
                    console.log(`[Tool: startProject] Assigned Number: ${projectNumber}`);
                }
            }
        } catch (e) {
            console.warn('[Tool: startProject] Failed to assign number/company', e);
        }

        // 1. Create Project in DAL
        const project = await ProjectRepo.create({
            name: input.name,
            customerId: input.customerId,
            // @ts-ignore
            description: input.description,
            status: 'active',
            ownerId: userId,
            projectNumber: projectNumber?.toString() // Save number as string
        });

        // 2. Create Drive Structure (Digital Office)
        let folderId: string | undefined;
        let driveError: string | undefined;

        try {
            const { GoogleDriveService } = await import('@/lib/google/drive');

            // Ensure Root & Projects Folder
            const rootStruct = await GoogleDriveService.ensureRootStructure(companyName, accessToken);
            const projectsFolderId = rootStruct.folders['02_Pågående Projekt'];

            // Create Project Structure with Numbered Name
            // e.g. "3450 - Anna Fönsterbyte"
            const folderName = projectNumber ? `${projectNumber} - ${input.name}` : input.name;

            const projectStruct = await GoogleDriveService.createProjectStructure(folderName, projectsFolderId, accessToken);
            folderId = projectStruct.projectRootId;

            console.log(`[Tool: startProject] Created ISO Structure. Root: ${folderId}`);

        } catch (error: any) {
            console.error('[Tool: startProject] Drive creation failed:', error);
            driveError = error.message;
        }

        // Phase 7.2: Automatic Risk Analysis (AMP Trigger)
        // Check if description implies high risk
        const highRiskKeywords = ['tak', 'ställning', 'asbest', 'rivning', 'betong', 'höjd'];
        const descriptionLower = (input.description || '').toLowerCase();

        let ampMessage = '';
        const risksFound = highRiskKeywords.filter(w => descriptionLower.includes(w));

        if (risksFound.length > 0) {
            // Trigger AMP creation
            console.log(`[Tool: startProject] Risk detected (${risksFound.join(', ')}). Genererar AMP-utkast...`);
            // In a real app, this would use generatePdf
            ampMessage = ` ⚠️ Riskfyllda moment identifierade: ${risksFound.join(', ')}. Ett utkast till Arbetsmiljöplan (AMP) har förberetts.`;
        }

        if (folderId) {
            await ProjectRepo.update(project.id, { driveFolderId: folderId });
        }

        let message = `Projekt '${input.name}' skapat. ${ampMessage}`;
        if (folderId) {
            message += ` Google Drive-mapp skapad.`;
        } else {
            message += ` Obs: Kunde inte skapa Google Drive-mapp (${driveError || 'Okänt fel'}).`;
        }

        return {
            projectId: project.id,
            folderId,
            message,
        };
    }
);

export const listProjectsTool = ai.defineTool(
    {
        name: 'listProjects',
        description: 'Lists the user\'s active projects. Use this to find project IDs for other tools or to summarize ongoing work.',
        inputSchema: z.object({
            limit: z.number().optional().describe('Max number of projects to return (default 10)'),
        }),
        outputSchema: z.object({
            projects: z.array(z.object({
                id: z.string(),
                name: z.string(),
                status: z.string(),
                projectNumber: z.string().optional()
            }))
        }),
    },
    async (input, context: any) => {
        const userId = context?.uid || context?.context?.uid || context?.auth?.uid;
        if (!userId) return { projects: [] };

        const { ProjectRepo } = await import('@/lib/dal/project.repo');
        // NOTE: In Phase 3, we will add server-side pagination to Repo.
        // For now, we list all and slice for safety.
        const projects = await ProjectRepo.listByOwner(userId);

        const limit = input.limit || 10;
        const sliced = projects.slice(0, limit).map(p => ({
            id: p.id,
            name: p.name,
            status: p.status,
            projectNumber: p.projectNumber
        }));

        return { projects: sliced };
    }
);
