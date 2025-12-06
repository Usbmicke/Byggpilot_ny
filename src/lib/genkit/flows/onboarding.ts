import 'server-only';
import { ai } from '@/lib/genkit';
import { z } from 'genkit'; // Genkit's Zod export or standard zod
import { firebaseAuth } from '@genkit-ai/firebase/auth';
import { UserRepo } from '@/lib/dal/user.repo';

// Input schema for the onboarding flow
const OnboardingInput = z.object({
    displayName: z.string().optional(),
});

// Output schema
const OnboardingOutput = z.object({
    success: z.boolean(),
    message: z.string(),
    user: z.any(), // Replace with proper User type schema if needed
});

export const onboardingFlow = ai.defineFlow(
    {
        name: 'onboardingFlow',
        inputSchema: OnboardingInput,
        outputSchema: OnboardingOutput,
        authPolicy: firebaseAuth((user) => {
            // Basic check: User must be authenticated
            if (!user) throw new Error('Unauthorized');
        }),
    },
    async (input, { auth }) => {
        // 1. Verify/Create user in Firestore via DAL
        if (!auth) throw new Error('Unexpected: Auth missing after policy check');

        const existingUser = await UserRepo.get(auth.uid);
        let user = existingUser;

        if (!existingUser) {
            await UserRepo.createOrUpdate(auth.uid, {
                uid: auth.uid,
                email: auth.email || null,
                displayName: input.displayName || auth.name || null,
                onboardingCompleted: false,
                createdAt: new Date() as any, // handled by DAL actually
            });
            user = await UserRepo.get(auth.uid);
        }

        if (user?.onboardingCompleted) {
            return { success: true, message: 'Already onboarded', user };
        }

        // 2. Authenticate against Google Drive (Service Account) & Check Folder
        const { GoogleDriveService } = await import('@/lib/google/drive');

        const companyName = user?.displayName || input.displayName || 'Mitt Företag';
        const folderName = `ByggPilot - ${companyName}`;

        console.log(`Checking/Creating Drive folder: ${folderName}`);
        const folderId = await GoogleDriveService.ensureFolderExists(folderName);

        // Update user with folder ID if needed (e.g. store in DAL)
        await UserRepo.createOrUpdate(auth.uid, {
            // @ts-ignore - Assuming we might add this field to UserData later
            driveFolderId: folderId
        });

        // 3. Mark as completed
        await UserRepo.createOrUpdate(auth.uid, {
            onboardingCompleted: true
        });

        const updatedUser = await UserRepo.get(auth.uid);

        return {
            success: true,
            message: 'Onboarding completed successfully',
            user: updatedUser
        };
    }
);
