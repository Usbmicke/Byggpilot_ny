'use client';

import { auth } from '@/lib/firebase/client';
import { signOut } from 'firebase/auth';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.push('/login');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const navigation = [
        { name: 'Översikt', href: '/', icon: '🏠' },
        { name: 'Projekt', href: '/projects', icon: '🏗️' },
        { name: 'Offerter', href: '/offers', icon: '📄' },
        { name: 'Kunder', href: '/customers', icon: '👥' },
        { name: 'Inställningar', href: '/settings', icon: '⚙️' },
    ];

    return (
        <aside className="w-64 bg-card border-r border-border shadow-md hidden md:flex flex-col h-full">
            <div className="p-6">
                <Link href="/">
                    <h1 className="text-2xl font-bold text-indigo-600">ByggPilot</h1>
                </Link>
            </div>
            <nav className="flex-1 px-4 space-y-1">
                {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`flex items-center px-4 py-3 text-sm font-medium rounded-md transition-colors ${isActive
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-primary/5 hover:text-foreground'
                                }`}
                        >
                            <span className="mr-3">{item.icon}</span>
                            {item.name}
                        </Link>
                    );
                })}
            </nav>
            <div className="p-4 border-t border-border">
                <div className="flex items-center group cursor-pointer" onClick={handleLogout}>
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">U</div>
                    <div className="ml-3">
                        <p className="text-sm font-medium text-foreground">Användare</p>
                        <p className="text-xs text-muted-foreground group-hover:text-red-500 transition-colors">Logga ut</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
