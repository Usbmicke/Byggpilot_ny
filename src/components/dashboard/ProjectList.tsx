import { useAuth } from '@/components/AuthProvider';
import { getProjectsAction } from '@/app/actions';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProjectCard } from '@/components/projects/ProjectCard';

export default function ProjectList() {
    const { user } = useAuth();
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        getProjectsAction(user.uid).then(res => {
            if (res.success && res.projects) {
                setProjects(res.projects); // Show all projects
            }
            setLoading(false);
        });
    }, [user]);

    if (loading) {
        return <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
            <div className="h-48 bg-background/50 rounded-lg"></div>
            <div className="h-48 bg-background/50 rounded-lg"></div>
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
        <div className="grid grid-cols-1 gap-4">
            {projects.map((p) => (
                <ProjectCard key={p.id} project={p} variant="horizontal" />
            ))}
        </div>
    );
}
