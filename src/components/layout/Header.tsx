'use client';

import { useAuth } from '@/components/AuthProvider';

export default function Header() {
    const { user } = useAuth();

    return (
        <header className="bg-white shadow-sm h-16 flex items-center justify-between px-6 z-10">
            <div className="flex items-center">
                <h2 className="text-lg font-semibold text-gray-800">
                    Dashboard {/* Breadcrumb placeholder */}
                </h2>
            </div>

            <div className="flex items-center space-x-4">
                <button
                    className="p-2 text-gray-400 hover:text-gray-500"
                    onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
                >
                    <span className="sr-only">Sök</span>
                    🔍 <span className="text-xs ml-1 bg-gray-100 px-2 py-0.5 rounded border">Cmd+K</span>
                </button>
                <div className="h-6 w-px bg-gray-200" aria-hidden="true" />
                <span className="text-sm text-gray-600">{user?.displayName || 'Välkommen'}</span>
            </div>
        </header>
    );
}
