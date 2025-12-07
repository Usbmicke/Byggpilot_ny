'use client';

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, writeBatch } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { useRouter } from 'next/navigation';
import { getUserStatusAction } from './actions';

export default function Home() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const [loginError, setLoginError] = useState<string | null>(null);
    const [isRedirecting, setIsRedirecting] = useState(false);

    // Auto-redirect if already logged in
    useEffect(() => {
        if (!isLoading && user) {
            setIsRedirecting(true);
            getUserStatusAction(user.uid).then((status) => {
                // @ts-ignore
                if (status.error) {
                    // @ts-ignore
                    setLoginError(`Serverfel: ${status.error} (Kan inte verifiera profil)`);
                    setIsRedirecting(false);
                } else if (status.isOnboardingCompleted) {
                    router.push('/dashboard');
                } else {
                    router.push('/onboarding');
                }
            });
        }
    }, [user, isLoading, router]);

    const handleGoogleLogin = async () => {
        try {
            setLoginError(null);
            const provider = new GoogleAuthProvider();
            provider.addScope('https://www.googleapis.com/auth/drive');
            provider.addScope('https://www.googleapis.com/auth/gmail.modify');
            provider.addScope('https://www.googleapis.com/auth/calendar');
            provider.addScope('https://www.googleapis.com/auth/tasks');
            provider.addScope('https://www.googleapis.com/auth/spreadsheets');
            provider.addScope('https://www.googleapis.com/auth/documents');
            provider.setCustomParameters({ prompt: 'select_account consent' });

            const result = await signInWithPopup(auth, provider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            if (credential?.accessToken) {
                localStorage.setItem('google_access_token', credential.accessToken);
            }

            // Check status via Server Action for consistency
            const status = await getUserStatusAction(result.user.uid);

            if (!status.exists) {
                // First time setup (Keep client side for Batch creation or move to Server Action later)
                // For now, keeping existing logic but simplified
                const batch = writeBatch(db);
                const userRef = doc(db, 'users', result.user.uid);
                const companyRef = doc(collection(db, 'companies'));

                batch.set(companyRef, {
                    name: `Företag ${result.user.displayName || ''}`,
                    createdAt: new Date(),
                    ownerId: result.user.uid,
                    settings: { theme: 'light', notifications: true }
                });

                batch.set(userRef, {
                    email: result.user.email,
                    displayName: result.user.displayName,
                    photoURL: result.user.photoURL,
                    companyId: companyRef.id,
                    role: 'ADMIN',
                    createdAt: new Date(),
                    status: 'active',
                    onboardingCompleted: false
                });

                await batch.commit();
                router.push('/onboarding');
            } else {
                if (status.isOnboardingCompleted) {
                    router.push('/dashboard');
                } else {
                    router.push('/onboarding');
                }
            }
        } catch (err: any) {
            setLoginError(err.message || 'Failed to login with Google');
            console.error(err);
        }
    };

    if (isLoading || isRedirecting) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
                <div className="text-xl animate-pulse text-muted-foreground">Laddar ByggPilot...</div>
            </div>
        );
    }

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-background text-foreground">
            {/* Abstract Background Shapes */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[100px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px]"></div>
            </div>

            <div className="relative z-10 flex flex-col items-center max-w-4xl text-center">
                <h1 className="text-6xl font-bold tracking-tight sm:text-7xl mb-6 text-foreground">
                    ByggPilot <span className="text-primary">2.0</span>
                </h1>

                <p className="text-xl text-muted-foreground max-w-2xl mb-12">
                    Sveriges smartaste bygg-plattform. Automatisera KMA, offerter och dokumentation.
                </p>

                {loginError && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg">
                        {loginError}
                    </div>
                )}

                <div className="flex gap-4 mb-16">
                    <button
                        onClick={handleGoogleLogin}
                        className="btn-primary text-lg px-8 py-4 flex items-center gap-3 shadow-xl hover:scale-105 transition-transform"
                    >
                        <svg className="h-6 w-6 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26-.19-.58z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        Logga in med Google
                    </button>
                </div>

                <div className="grid md:grid-cols-3 gap-6 text-left w-full">
                    <FeatureCard title="AI Kalkylator" description="Generera offerter blixtsnabbt med Gemini AI." />
                    <FeatureCard title="Auto-KMA" description="Skapa riskanalyser och arbetsmiljöplaner automatiskt." />
                    <FeatureCard title="Google Sync" description="Allt sparas i din egen Google Drive." />
                </div>
            </div>
        </main>
    );
}

function FeatureCard({ title, description }: { title: string, description: string }) {
    return (
        <div className="p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors shadow-sm">
            <h3 className="font-semibold text-lg mb-2 text-foreground">{title}</h3>
            <p className="text-muted-foreground text-sm">{description}</p>
        </div>
    );
}
