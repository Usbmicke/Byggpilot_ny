'use client';

import { useAuth } from '@/components/AuthProvider';
import { getProjectsAction } from '@/app/actions';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function ProjectList() {
    const { user } = useAuth();
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        getProjectsAction(user.uid).then(res => {
            if (res.success && res.projects) {
                setProjects(res.projects.slice(0, 5)); // Limit to 5
            }
            setLoading(false);
        });
    }, [user]);

    if (loading) {
        return <div className="space-y-2 animate-pulse">
            <div className="h-10 bg-background/50 rounded-lg"></div>
            <div className="h-10 bg-background/50 rounded-lg"></div>
        </div>;
    }

    if (projects.length === 0) {
        return (
            <div className="text-center py-8 rounded-lg border border-dashed border-border bg-background/20">
                <p className="text-muted-foreground mb-4 text-sm">Inga aktiva projekt</p>
                <Link href="/projects" className="btn-primary text-sm inline-flex items-center">
                    + Skapa ditt första projekt
                </Link>
            </div>
        );
    }

    return (
        <div className="overflow-hidden">
            <ul className="divide-y divide-border">
                {projects.map((p) => (
                    <li key={p.id} className="p-3 hover:bg-background/40 transition-colors text-foreground flex justify-between items-center rounded-lg">
                        <span className="font-medium">{p.name}</span>
                        <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">{p.status === 'active' ? 'Pågående' : p.status}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
