'use client';

import { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDoc, setDoc, collection } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleGoogleLogin = async () => {
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            // Check if user exists
            const userDoc = await getDoc(doc(db, 'users', user.uid));

            if (!userDoc.exists()) {
                // Create new company
                const companyRef = doc(collection(db, 'companies'));
                await setDoc(companyRef, {
                    name: `Företag ${user.displayName || ''}`,
                    createdAt: new Date(),
                    ownerId: user.uid,
                    settings: {
                        theme: 'light',
                        notifications: true
                    }
                });

                // Create new user linked to company
                await setDoc(doc(db, 'users', user.uid), {
                    email: user.email,
                    displayName: user.displayName,
                    photoURL: user.photoURL,
                    companyId: companyRef.id,
                    role: 'ADMIN',
                    createdAt: new Date(),
                    status: 'active'
                });
            }

            router.push('/'); // Redirect to dashboard/home after login
        } catch (err: any) {
            setError(err.message || 'Failed to login with Google');
            console.error(err);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="w-full max-w-md space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
                        Logga in på ByggPilot
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Ditt digitala kontor för byggprojekt
                    </p>
                </div>
                <div className="mt-8 space-y-6">
                    {error && (
                        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
                            {error}
                        </div>
                    )}
                    <button
                        onClick={handleGoogleLogin}
                        className="group relative flex w-full justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                            {/* Icon placeholder */}
                        </span>
                        Logga in med Google
                    </button>
                </div>
            </div>
        </div>
    );
}
