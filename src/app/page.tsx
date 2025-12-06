'use client';

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, writeBatch } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { useRouter } from 'next/navigation';

export default function Home() {
    const { user, isLoading } = useAuth(); // Använd isLoading för att undvika flicker
    const router = useRouter();
    const [loginError, setLoginError] = useState<string | null>(null);

    const handleGoogleLogin = async () => {
        try {
            setLoginError(null);
            const provider = new GoogleAuthProvider();

            // Add scopes for full Google Workspace integration
            provider.addScope('https://www.googleapis.com/auth/drive');
            provider.addScope('https://www.googleapis.com/auth/gmail.modify');
            provider.addScope('https://www.googleapis.com/auth/calendar');
            provider.addScope('https://www.googleapis.com/auth/tasks');
            provider.addScope('https://www.googleapis.com/auth/spreadsheets');
            provider.addScope('https://www.googleapis.com/auth/documents');

            // Force consent prompt to ensure all scopes are visible/granted
            provider.setCustomParameters({
                prompt: 'select_account consent'
            });

            const result = await signInWithPopup(auth, provider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const token = credential?.accessToken;

            if (token) {
                // Save token for Drive API usage in Onboarding/Dashboard
                localStorage.setItem('google_access_token', token);
            }

            const loggedInUser = result.user;

            // Check if user exists
            const userDocRef = doc(db, 'users', loggedInUser.uid);
            const userDoc = await getDoc(userDocRef);

            let isOnboardingCompleted = false;

            if (!userDoc.exists()) {
                // Use a Batch Write to ensure both Company and User are created, or neither.
                // This prevents "orphaned companies" if the user creation fails.
                const batch = writeBatch(db);

                const companyRef = doc(collection(db, 'companies'));
                batch.set(companyRef, {
                    name: `Företag ${loggedInUser.displayName || ''}`,
                    createdAt: new Date(),
                    ownerId: loggedInUser.uid,
                    settings: {
                        theme: 'light',
                        notifications: true
                    }
                });

                // Create new user linked to company
                batch.set(userDocRef, {
                    email: loggedInUser.email,
                    displayName: loggedInUser.displayName,
                    photoURL: loggedInUser.photoURL,
                    companyId: companyRef.id,
                    role: 'ADMIN',
                    createdAt: new Date(),
                    status: 'active',
                    onboardingCompleted: false // Default to false
                });

                // Commit the batch
                await batch.commit();
                console.log("✅ Created new Company and User atomically.");
            } else {
                // User exists, check onboarding status
                const userData = userDoc.data();
                isOnboardingCompleted = userData?.onboardingCompleted === true;
            }

            if (isOnboardingCompleted) {
                router.push('/dashboard');
            } else {
                router.push('/onboarding');
            }
        } catch (err: any) {
            setLoginError(err.message || 'Failed to login with Google');
            console.error(err);
        }
    };

    // Enkel loading state för bättre UX
    if (isLoading) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
                <div className="text-xl animate-pulse text-muted-foreground">Laddar ByggPilot...</div>
            </div>
        );
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-background text-foreground bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-card via-background to-background">

            <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex absolute top-0 p-6">
                <p className="fixed left-0 top-0 flex w-full justify-center border-b border-border bg-background/50 backdrop-blur-md py-4 lg:static lg:w-auto lg:rounded-xl lg:border lg:bg-card/50 lg:p-4 shadow-xl text-muted-foreground">
                    Sveriges smartaste bygg-plattform
                </p>
                <div className="fixed bottom-0 left-0 flex h-48 w-full items-end justify-center bg-gradient-to-t from-background via-background lg:static lg:h-auto lg:w-auto lg:bg-none">
                    <span className="text-muted-foreground pointer-events-none flex place-items-center gap-2 p-8 lg:pointer-events-auto lg:p-0">
                        ByggPilot 2.0
                    </span>
                </div>
            </div>

            <div className="relative flex flex-col place-items-center z-0">
                {/* Glow effect */}
                <div className="absolute -z-10 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] opacity-20 animate-pulse"></div>
                <h1 className="text-6xl font-bold tracking-tight sm:text-8xl text-center mb-6 drop-shadow-2xl text-transparent bg-clip-text bg-gradient-to-br from-white to-gray-500">
                    ByggPilot
                </h1>

                {loginError && (
                    <div className="mb-4 p-3 bg-red-900/20 border border-red-900/50 text-red-400 rounded-md text-sm max-w-md text-center">
                        {loginError}
                    </div>
                )}
            </div>

            <p className="mt-4 text-xl text-muted-foreground text-center max-w-2xl mb-12 animate-fade-in-up">
                AI-driven projektledning för moderna byggföretag. Automatisera KMA, offerter och dokumentation med en knapptryckning.
            </p>

            <div className="mb-32 grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-3 lg:text-left gap-6">
                <div className="group rounded-xl border border-border bg-card/50 px-5 py-6 transition-all hover:bg-card hover:border-primary/30 card hover:shadow-2xl hover:shadow-primary/10 cursor-default">
                    <h2 className={`mb-3 text-2xl font-semibold text-foreground`}>
                        AI Kalkylator{" "}
                        <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none text-primary">
                            -&gt;
                        </span>
                    </h2>
                    <p className={`m-0 max-w-[30ch] text-sm text-muted-foreground`}>
                        Generera exakta offerter med hjälp av Gemini 2.5 Flash och tidsstudier.
                    </p>
                </div>

                <div className="group rounded-xl border border-border bg-card/50 px-5 py-6 transition-all hover:bg-card hover:border-primary/30 card hover:shadow-2xl hover:shadow-primary/10 cursor-default">
                    <h2 className={`mb-3 text-2xl font-semibold text-foreground`}>
                        Auto-KMA{" "}
                        <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none text-primary">
                            -&gt;
                        </span>
                    </h2>
                    <p className={`m-0 max-w-[30ch] text-sm text-muted-foreground`}>
                        Skapa arbetsmiljöplaner och riskanalyser automatiskt baserat på projektbeskrivning.
                    </p>
                </div>

                <div className="group rounded-xl border border-border bg-card/50 px-5 py-6 transition-all hover:bg-card hover:border-primary/30 card hover:shadow-2xl hover:shadow-primary/10 cursor-default">
                    <h2 className={`mb-3 text-2xl font-semibold text-foreground`}>
                        Google Sync{" "}
                        <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none text-primary">
                            -&gt;
                        </span>
                    </h2>
                    <p className={`m-0 max-w-[30ch] text-sm text-muted-foreground`}>
                        Allt sparas direkt i din Google Drive struktur. Inget datafängelse.
                    </p>
                </div>
            </div>

            <div className="fixed bottom-10 flex flex-col items-center gap-4 z-20">
                {user ? (
                    <Link
                        href="/dashboard"
                        className="btn-primary text-lg px-8 py-3 shadow-[0_0_20px_rgba(88,101,242,0.3)] hover:shadow-[0_0_30px_rgba(88,101,242,0.5)] border border-primary/50"
                    >
                        Gå till Dashboard
                    </Link>
                ) : (
                    <button
                        onClick={handleGoogleLogin}
                        className="btn-primary text-lg px-8 py-3 shadow-[0_0_20px_rgba(88,101,242,0.3)] hover:shadow-[0_0_30px_rgba(88,101,242,0.5)] border border-primary/50 flex items-center gap-3"
                    >
                        {/* Google Icon */}
                        <svg className="h-5 w-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26-.19-.58z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Logga in med Google
                    </button>
                )}
            </div>
        </main>
    );
}
