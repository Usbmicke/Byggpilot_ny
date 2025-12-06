'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
    const pathname = usePathname();

    const navigation = [
        { name: 'Översikt', href: '/', icon: '🏠' },
        { name: 'Projekt', href: '/projects', icon: '🏗️' },
        { name: 'Offerter', href: '/offers', icon: '📄' },
        { name: 'Kunder', href: '/customers', icon: '👥' },
        { name: 'Inställningar', href: '/settings', icon: '⚙️' },
    ];

    return (
        <aside className="w-64 bg-white shadow-md hidden md:flex flex-col h-full">
            <div className="p-6">
                <h1 className="text-2xl font-bold text-indigo-600">ByggPilot</h1>
            </div>
            <nav className="flex-1 px-4 space-y-1">
                {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${isActive
                                ? 'bg-indigo-50 text-indigo-700'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }`}
                        >
                            <span className="mr-3">{item.icon}</span>
                            {item.name}
                        </Link>
                    );
                })}
            </nav>
            <div className="p-4 border-t border-gray-200">
                <div className="flex items-center">
                    <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center text-xs font-medium">U</div>
                    <div className="ml-3">
                        <p className="text-sm font-medium text-gray-700">Användare</p>
                        <p className="text-xs text-gray-500">Logga ut</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
