'use client';

import { auth } from '@/lib/firebase/client';
import { signOut } from 'firebase/auth';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getGlobalStatusAction } from '@/app/actions';
import { useState, useEffect } from 'react';

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const { user } = useAuth();
    const [status, setStatus] = useState({ profileIncomplete: false, incompleteCustomersCount: 0 });

    useEffect(() => {
        if (user) {
            getGlobalStatusAction(user.uid).then(res => {
                if (res.success) {
                    setStatus({
                        profileIncomplete: !!res.profileIncomplete,
                        incompleteCustomersCount: res.incompleteCustomersCount || 0
                    });
                }
            });
        }
    }, [user, pathname]); // Re-fetch on navigation to update if fixed

    const handleLogout = async () => {
        try {
            await signOut(auth);
            router.push('/login');
        } catch (error) {
            console.error('Logout error:', error);
        }
    };

    const navigation = [
        { name: 'Översikt', href: '/dashboard', icon: '🏠', warning: false },
        { name: 'Projekt', href: '/projects', icon: '🏗️', warning: false },
        { name: 'Offerter', href: '/offers', icon: '📄', warning: false },
        { name: 'Ekonomi', href: '/economy', icon: '💸', warning: false },
        { name: 'Kunder', href: '/customers', icon: '👥', warning: status.incompleteCustomersCount > 0 },
        { name: 'Inställningar', href: '/settings', icon: '⚙️', warning: status.profileIncomplete },
    ];

    return (
        <aside className="w-64 bg-card border-r border-border shadow-md hidden md:flex flex-col h-full">
            <div className="p-6">
                <Link href="/dashboard">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">ByggPilot</h1>
                </Link>
            </div>
            <nav className="flex-1 px-4 space-y-1">
                {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={`flex items-center justify-between px-4 py-3 text-sm font-medium rounded-md transition-colors ${isActive
                                ? 'bg-primary/10 text-primary'
                                : 'text-muted-foreground hover:bg-primary/5 hover:text-foreground'
                                }`}
                        >
                            <div className="flex items-center">
                                <span className="mr-3">{item.icon}</span>
                                {item.name}
                            </div>
                            {item.warning && (
                                <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse shadow-sm shadow-amber-200" title="Åtgärd krävs"></div>
                            )}
                        </Link>
                    );
                })}
            </nav>
            <div className="p-4 border-t border-border">
                <div className="flex items-center group cursor-pointer" onClick={handleLogout}>
                    <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">U</div>
                    <div className="ml-3">
                        <p className="text-sm font-medium text-foreground">{user?.displayName || 'Användare'}</p>
                        <p className="text-xs text-muted-foreground group-hover:text-red-500 transition-colors">Logga ut</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
