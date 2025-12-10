import 'server-only';
import { ai } from '@/lib/genkit-instance';
import { z } from 'genkit';
import { GoogleDriveService } from '@/lib/google/drive';

export const repairDriveTool = ai.defineTool(
    {
        name: 'repairDrive',
        description: 'Re-creates or repairs the company folder structure in Google Drive. Use this when the user says "fix my drive", "create folders", or "structure is missing".',
        inputSchema: z.object({}),
        outputSchema: z.object({
            success: z.boolean(),
            message: z.string(),
            rootId: z.string().optional(),
        }),
    },
    async (input, context: any) => {
        // Handle nested context from Genkit
        const userId = context?.uid || context?.context?.uid || context?.auth?.uid;
        const accessToken = context?.accessToken || context?.context?.accessToken;

        console.log(`🔧 [Tool: repairDrive] User: ${userId}, Token Present: ${!!accessToken}`);

        if (!userId || !accessToken) {
            return {
                success: false,
                message: 'Error: Missing authentication (User ID or Google Token). Please log out and in again.',
            };
        }

        try {
            const { UserRepo } = await import('@/lib/dal/user.repo');
            const { CompanyRepo } = await import('@/lib/dal/company.repo');

            const user = await UserRepo.get(userId);
            if (!user?.companyId) {
                return { success: false, message: 'User is not linked to a company.' };
            }

            const company = await CompanyRepo.get(user.companyId);
            // Priority: Profile Name (Display) > System Name > Default
            const companyName = company?.profile?.name || company?.name || "Mitt Företag";

            console.log(`[Tool: repairDrive] Repairing structure for ${companyName}`);
            const result = await GoogleDriveService.ensureRootStructure(companyName, accessToken);

            // Also update company with root folder ID if missing
            // Update company with Drive Structure
            const driveStructure = {
                rootId: result.rootId,
                customersId: result.folders['01_Kunder & Anbud'],
                projectsId: result.folders['02_Pågående Projekt'],
                documentationId: result.folders['04_Företagsmallar'],
                // offersId: result.folders['...'] // If needed
            };

            await CompanyRepo.updateDriveStructure(user.companyId, driveStructure);

            return {
                success: true,
                message: `Google Drive-strukturen är återställd/skapad! Rotmapp: "ByggPilot - ${companyName}"`,
                rootId: result.rootId
            };

        } catch (error: any) {
            console.error('[Tool: repairDrive] Failed:', error);
            return {
                success: false,
                message: `Misslyckades att fixa Drive: ${error.message}`
            };
        }
    }
);
