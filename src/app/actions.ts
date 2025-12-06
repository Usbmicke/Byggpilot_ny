'use server'; // Detta gör funktionen anropningsbar från klienten

import { ai } from '@/lib/genkit'; // Importera vår instans

// För enkelhetens skull kör vi direkt generering här:

export async function generateTextAction(prompt: string) {
  try {
    const { text } = await ai.generate({
      model: 'googleai/gemini-1.5-flash', // Eller 'gemini-2.0-flash-exp' om du har tillgång
      prompt: prompt,
      config: {
        temperature: 0.7,
      },
    });

    return { success: true, text };
  } catch (error: any) {
    console.error("Genkit Error:", error);
    return { success: false, error: error.message };
  }
}

import { auth, db } from '@/lib/firebase-admin'; // Server-side admin SDK
import { headers } from 'next/headers';

export async function getUserProfileAction(): Promise<{ companyName?: string } | null> {
  try {
    // Note: In a real app, verify the session token from cookies/headers
    // For now, we stub this or return null
    return null;
  } catch (error) {
    console.error("Profile Error:", error);
    return null;
  }
}

// Need to return current user context to know who is calling
// But since this is a server action, we need a way to get the current user.
// In a real App Router app using Firebase Auth Client SDK, the standard way is to 
// verify the ID token sent in cookies or headers.
// However, since we are using client-side auth mainly, we might need to pass the UID or rely on the client to update directly?
// NO - Actions should be secure.
// But we don't have a session cookie set up yet (? - check AuthProvider). 
// AuthProvider only manages client state.
// We should probably do this client side for MVP or accept a token.
// The Plan said: "Update Onboarding Complete Action (Set flag to true)"
// Given the setup in `onboarding/page.tsx` calls `runOnboardingAction` passing `{ companyName, logoUrl }`.
// `getUserProfileAction` is also called there.

// Let's implement this using `firebase-admin` but we really need the UID.
// For now, to keep it simple and working without full session management rewrite:
// We will accept `uid` as an argument - DISCLAIMER: INSECURE for production without token verification, 
// but fits the current "MVP/Alpha" stage described in `task.md`.
// WAIT -> `onboarding/page.tsx` has `user` available. We can pass it.
// UPDATED SIGNATURE: runOnboardingAction(data: { companyName: string, logoUrl?: string, uid: string })

// Actually, `getUserProfileAction` is also failing to get the user.
// Users are logged in via Client SDK. Server Actions don't automatically know this unless we pass a token.

// PLAN B: Do the update Client-Side in `onboarding/page.tsx` directly?
// "firebase? ska känna av detta automatiskt"
// If we do it client side, it's easier and works with the current AuthProvider.
// The user explicitly mentioned "firebase?".
// So let's NOT implement `runOnboardingAction` as a server action if it requires complex session handling we don't have.
// Instead, let's use the Client SDK in `onboarding/page.tsx` to update the document.
// OR pass the UID to the action.
// Let's try to stick to the pattern but modifying the logic to be client-side if possible?
// The file `src/app/actions.ts` implies server actions.
// Let's modify `onboarding/page.tsx` to update Firestore directly using `db` from client.ts.

// BUT wait, I am in `actions.ts` right now.
// I will Stub `runOnboardingAction` to return success (or implement if I can verify token)
// AND UPDATE `onboarding/page.tsx` to do the actual write.
// OR pass the UID. Passing UID is "okay" for a prototype if we trust the client (we don't usually).

// Let's check `src/app/onboarding/page.tsx`. It calls `runOnboardingAction`.
// I'll modify `onboarding/page.tsx` to handle the database update directly since it has the authenticated `user` object and `db` access. 
// This avoids the complexities of verifying Auth tokens in server actions without a middleware.

export async function runOnboardingAction(data: { companyName: string, logoUrl?: string }) {
  // We will deprecate this logic in favor of client-side update for now,
  // or just log it.
  return { success: true };
}
