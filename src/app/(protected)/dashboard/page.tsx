'use client';

import { useAuth } from '@/components/AuthProvider';
import ProjectList from '@/components/dashboard/ProjectList';
import QuickLog from '@/components/dashboard/QuickLog';
import TasksWidget from '@/components/dashboard/TasksWidget';
import CriticalStopsWidget from '@/components/dashboard/CriticalStopsWidget';


export default function DashboardPage() {
    const { user } = useAuth();

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex justify-between items-end border-b border-border pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Översikt</h1>
                    <p className="text-muted-foreground mt-1">Välkommen tillbaka, <span className="text-primary font-medium">{user?.displayName || 'Användare'}</span>.</p>
                </div>
                <div className="text-xs text-muted-foreground font-mono bg-card px-3 py-1 rounded-full border border-border">
                    {new Date().toLocaleDateString('sv-SE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <section className="bg-card rounded-xl p-6 shadow-lg border border-border/50">
                        <h2 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
                            <span className="w-1 h-6 bg-primary rounded-full"></span>
                            Mina Projekt
                        </h2>
                        <ProjectList />
                    </section>
                </div>

                <div className="space-y-8">
                    {/* Critical Stops (Strategic Audit) */}
                    <CriticalStopsWidget />


                    <div className="bg-card rounded-xl p-6 shadow-lg border border-border/50">
                        <h2 className="text-lg font-medium text-foreground mb-4">Snabblogg</h2>
                        <QuickLog />
                    </div>

                    {/* Placeholder Widgets */}
                    {/* (Weather is now on Project Cards as requested) */}

                    <div className="h-96">
                        <TasksWidget />
                    </div>
                </div>
            </div>
        </div>
    );
}
