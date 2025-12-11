'use client';

import { useAuth } from '@/components/AuthProvider';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export default function Header() {
    const { user } = useAuth();

    const pathname = usePathname();
    const pathSegments = pathname.split('/').filter(Boolean);

    const breadcrumbs = pathSegments.map((segment, index) => {
        const href = `/${pathSegments.slice(0, index + 1).join('/')}`;
        const label = segment.charAt(0).toUpperCase() + segment.slice(1);
        const isLast = index === pathSegments.length - 1;

        // Custom Labels
        const displayLabel = label === 'Dashboard' ? 'Översikt' :
            label === 'Projects' ? 'Projekt' :
                label === 'Customers' ? 'Kunder' :
                    label === 'Offers' ? 'Offerter' :
                        label === 'Settings' ? 'Inställningar' :
                            label === 'Ata' ? 'ÄTA' :
                                label.length > 20 ? label.substring(0, 20) + '...' : label;

        return (
            <span key={href} className="flex items-center">
                {index > 0 && <span className="mx-2 text-muted-foreground">/</span>}
                {isLast ? (
                    <span className="font-semibold text-foreground">{displayLabel}</span>
                ) : (
                    <Link href={href} className="text-muted-foreground hover:text-foreground transition-colors">
                        {displayLabel}
                    </Link>
                )}
            </span>
        );
    });

    return (
        <header className="bg-card shadow-sm h-16 flex items-center justify-between px-6 z-10 border-b border-border">
            <div className="flex items-center text-sm">
                {breadcrumbs.length > 0 ? breadcrumbs : <span className="font-semibold text-foreground">Översikt</span>}
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
