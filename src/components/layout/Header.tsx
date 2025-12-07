'use client';

import { useAuth } from '@/components/AuthProvider';

export default function Header() {
    const { user } = useAuth();

    return (
        <header className="bg-card shadow-sm h-16 flex items-center justify-between px-6 z-10 border-b border-border">
            <div className="flex items-center">
                <h2 className="text-lg font-semibold text-foreground">
                    Dashboard {/* Breadcrumb placeholder */}
                </h2>
            </div>

            <div className="flex items-center space-x-4">
                <button
                    className="p-2 text-muted-foreground hover:text-foreground"
                    onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
                >
                    <span className="sr-only">Sök</span>
                    🔍 <span className="text-xs ml-1 bg-background px-2 py-0.5 rounded border border-border">Cmd+K</span>
                </button>
                <div className="h-6 w-px bg-border" aria-hidden="true" />
                <span className="text-sm text-muted-foreground">{user?.displayName || 'Välkommen'}</span>
            </div>
        </header>
    );
}
