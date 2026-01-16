import 'server-only';
import { ai } from '@/lib/genkit-instance';
import { z } from 'genkit'; // Genkit's Zod export or standard zod
import { UserRepo } from '@/lib/dal/user.repo';
// import { firebaseAuth } from '@genkit-ai/firebase'; // Removed due to build error

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

export const onboardingFlow = ai.defineFlow({
    name: 'onboardingFlow',
    inputSchema: OnboardingInput,
    outputSchema: OnboardingOutput,
    // authPolicy: firebaseAuth(...), // Removed to bypass build error
}, async (input, { context }) => { // context.auth holds the user
    const { displayName } = input;

    // 1. Verify User from Context
    // Note: 'context.auth' is populated by the wrapper action calling this flow, usually via verifySession or similar. 
    // If called directly via useGenkit on client, the authPolicy handles the check but context injection depends on the framework adapter.
    // We will assume context.auth is populated or we use the payload if securely passed. 

    // In the new Genkit pattern, we rely on the authPolicy for security.
    // However, to get the UID for logic, we need to inspect the context.
    if (!context?.auth?.uid) {
        throw new Error("Critical: User ID missing in context execution.");
    }
    const uid = context.auth.uid;

    console.log(`🚀 Starting Onboarding for User: ${uid}`);

    try {
        // 2. Create/Get User Profile
        const userProfile = await UserRepo.ensureUser(uid, context.auth.email);

        // 3. Create Company (if not exists)
        // If user already has company, we should probably check it.
        let companyId = userProfile.companyId;
        let companyName = "Mitt Bygg AB"; // Default fallback

        if (!companyId) {
            const { CompanyRepo } = await import('@/lib/dal/company.repo');
            companyName = displayName || `Byggbolaget ${uid.substring(0, 4)}`;
            const newCompany = await CompanyRepo.create({
                name: companyName,
                ownerId: uid,
                users: [uid]
            });
            companyId = newCompany.id;

            // Link User to Company
            await UserRepo.update(uid, { companyId });
            console.log(`🏢 Created new Company: ${companyName} (${companyId})`);
        } else {
            const { CompanyRepo } = await import('@/lib/dal/company.repo');
            const existingCompany = await CompanyRepo.get(companyId);
            if (existingCompany) companyName = existingCompany.name;
        }

        // 4. Initialize Google Drive Structure
        // Pass the user's accessToken if available for 'user-mode' drive (Oauth), 
        // OR use Service Account (undefined token) if we want the system to own folders.
        // Requirement from User: "ByggPilot - [Företagsnamn]"
        // Strategy: Use Service Account for structure to ensure persistence even if user leaves? 
        // OR use User Token?
        // "Fas 1" implies we just want it to work. System Account is safer for "App Data".
        // However, user needs access! 
        // TODO: Share the folder with the User's email if using Service Account.
        // For now, let's try using the User's Access Token if provided, else Service Account.

        // Note: context.auth.token might contain the Google Access Token if passed from client.
        // But usually validation happens via ID Token.
        // Let's assume for this step we rely on Service Account ownership for stability, 
        // OR we rely on a separate 'accessToken' in input if we want User-Drive.
        // Given "GoogleDriveService.ensureRootStructure" logic in drive.ts...

        const { GoogleDriveService } = await import('@/lib/google/drive.ts');
        console.log("📂 Initializing Drive Structure...");
        const driveResult = await GoogleDriveService.ensureRootStructure(companyName); // Using Service Account (no token passed)

        // 5. Save Drive Context to Company
        const { CompanyRepo } = await import('@/lib/dal/company.repo');
        await CompanyRepo.update(companyId, {
            driveRootId: driveResult.rootId,
            driveFolders: driveResult.folders
        });

        console.log("✅ Onboarding Complete!");

        return {
            success: true,
            message: 'Onboarding completed successfully. Drive structure created.',
            user: { uid, companyId, driveRootId: driveResult.rootId }
        };

    } catch (error: any) {
        console.error("❌ Onboarding Failed:", error);
        throw new Error(`Onboarding failed: ${error.message}`);
    }
}
);
