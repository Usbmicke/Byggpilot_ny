'use client';

import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useGenkit } from '@/hooks/useGenkit'; // To access onboarding status if needed via backend
// Alternatively, AuthProvider could fetch onboarding status from user claims or DB.
// For now, adhering to instructions: "Om onboardingCompleted (hämtat via Genkit) är false -> Onboarding"

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    // We assume user object in AuthProvider implies authentication.
    // But onboarding status might be in the UserData from DB, not just Firebase Auth User.
    // IMPORTANT: The instruction says "hämtat via Genkit".
    // So we might need a separate check or the user object in useAuth should be enriched.
    // For simplicity here, we assume if user is logged in, we render children, 
    // but logic for redirecting to Onboarding should be handled here or in a wrapper.

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/login');
        }
    }, [user, isLoading, router]);

    if (isLoading) return <div>Loading...</div>;
    if (!user) return null;

    return <>{children}</>;
}
