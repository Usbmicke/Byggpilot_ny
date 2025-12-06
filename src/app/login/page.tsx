'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const router = useRouter();

    useEffect(() => {
        router.push('/');
    }, [router]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
            <p>Omdirigerar...</p>
        </div>
    );
}
