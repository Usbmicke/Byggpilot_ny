'use client';

import { useState, useEffect } from 'react';
import { useGenkit } from '@/hooks/useGenkit';
import { useRouter } from 'next/navigation';

export default function OnboardingWizard() {
    const [displayName, setDisplayName] = useState('');
    const { runFlow, isLoading, error, result } = useGenkit('onboardingFlow');
    const router = useRouter();
    const [isVisible, setIsVisible] = useState(false);

    // Initial check logic simulation
    useEffect(() => {
        // In a real app, check user profile here.
        // For now, we default to hidden to not annoy dev, 
        // but since user asked "first time", we might want it visible if we can't check.
        // Let's rely on a local storage flag for dev convenience "hasSeenOnboarding"
        const hasSeen = localStorage.getItem('hasSeenOnboarding');
        if (!hasSeen) {
            setIsVisible(true);
        }
    }, []);

    const handleStart = async () => {
        try {
            await runFlow({ displayName });
            localStorage.setItem('hasSeenOnboarding', 'true');
            window.location.reload();
        } catch (e) {
            console.error(e);
        }
    };

    if (!isVisible) return null;

    if (result?.success) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="bg-card p-8 rounded-lg shadow-xl text-center border border-border">
                    <h2 className="text-2xl font-bold mb-4 text-foreground">Klart!</h2>
                    <p className="text-muted-foreground">Ditt digitala kontor är redo.</p>
                    <button
                        onClick={() => {
                            localStorage.setItem('hasSeenOnboarding', 'true');
                            window.location.reload();
                        }}
                        className="mt-4 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                        Börja jobba
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-card p-8 rounded-lg shadow-xl w-full max-w-lg relative border border-border">
                {/* Dev Close Button */}
                <button
                    onClick={() => setIsVisible(false)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                    title="Stäng (Dev)"
                >
                    ✕
                </button>

                <h2 className="text-2xl font-bold mb-4 text-foreground">Välkommen till ByggPilot</h2>
                <p className="mb-6 text-muted-foreground">Vi behöver sätta upp din arbetsmiljö. Detta tar bara ett ögonblick.</p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-foreground">Visningsnamn</label>
                        <input
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="mt-1 block w-full rounded-md border-border bg-background text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm p-2 border outline-none"
                            placeholder="Ditt Namn"
                        />
                    </div>

                    {error && (
                        <div className="p-4 bg-red-50 text-red-700 rounded">
                            {error.message}
                        </div>
                    )}

                    <button
                        onClick={handleStart}
                        disabled={isLoading}
                        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                        {isLoading ? 'Konfigurerar...' : 'Starta Onboarding'}
                    </button>
                </div>
            </div>
        </div>
    );
}
