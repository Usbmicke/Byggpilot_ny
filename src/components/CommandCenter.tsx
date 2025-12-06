'use client';

import { useEffect, useState } from 'react';

export default function CommandCenter() {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen((prev) => !prev);
            }
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-20">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-25 transition-opacity" onClick={() => setIsOpen(false)} />

            <div className="mx-auto max-w-xl transform divide-y divide-gray-100 overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black ring-opacity-5 transition-all">
                <div className="relative">
                    <input
                        type="text"
                        className="h-12 w-full border-0 bg-transparent pl-11 pr-4 text-gray-800 placeholder-gray-400 focus:ring-0 sm:text-sm"
                        placeholder="Sök kommandon eller projekt..."
                        autoFocus
                    />
                    <div className="pointer-events-none absolute top-3.5 left-4 text-gray-400">🔍</div>
                </div>

                <ul className="max-h-72 scroll-py-2 overflow-y-auto py-2 text-sm text-gray-800">
                    <li className="cursor-default select-none px-4 py-2 hover:bg-indigo-600 hover:text-white group">
                        <div className="font-medium">Nytt Projekt</div>
                        <div className="text-xs text-gray-500 group-hover:text-indigo-200">Starta ett nytt byggprojekt</div>
                    </li>
                    <li className="cursor-default select-none px-4 py-2 hover:bg-indigo-600 hover:text-white group">
                        <div className="font-medium">Logga Tid</div>
                        <div className="text-xs text-gray-500 group-hover:text-indigo-200">Snabbregistrering av arbetstimmar</div>
                    </li>
                </ul>
            </div>
        </div>
    );
}
