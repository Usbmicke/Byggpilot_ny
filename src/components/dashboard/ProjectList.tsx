'use client';

import { useGenkit } from '@/hooks/useGenkit';

export default function ProjectList() {
    // Assuming we have a 'listProjectsFlow' or similar. 
    // If not, we'll placeholder it for now as per plan.
    // 'viktigt.md' says "Hämta aktiva projekt via Genkit+DAL".
    const { result, error, isLoading, runFlow } = useGenkit('listProjectsFlow');

    // Trigger flow on mount? Or useSWR directly if GET?
    // useGenkit wraps SWR mutation (POST). For fetching lists, we might want standard useSWR + GET route
    // OR just trigger the flow on effect. 
    // For simplicity/speed now, we'll just show empty state as per instruction "Implementera Zero State".

    const projects: any[] = result?.projects || [];

    if (projects.length === 0) {
        return (
            <div className="text-center py-12 rounded-lg border border-dashed border-border bg-background/50">
                <p className="text-muted-foreground mb-4">Inga aktiva projekt</p>
                <button className="btn-primary">
                    + Skapa ditt första projekt
                </button>
            </div>
        );
    }

    return (
        <div className="overflow-hidden">
            <ul className="divide-y divide-border">
                {projects.map((p) => (
                    <li key={p.id} className="p-4 hover:bg-white/5 transition-colors text-foreground">
                        {p.name}
                    </li>
                ))}
            </ul>
        </div>
    );
}
