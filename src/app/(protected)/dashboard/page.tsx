'use client';

import { useAuth } from '@/components/AuthProvider';
import ProjectList from '@/components/dashboard/ProjectList';
import QuickLog from '@/components/dashboard/QuickLog';

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
                    <div className="bg-card rounded-xl p-6 shadow-lg border border-border/50">
                        <h2 className="text-lg font-medium text-foreground mb-4">Snabblogg</h2>
                        <QuickLog />
                    </div>

                    {/* Placeholder Widgets */}
                    <div className="bg-card rounded-xl shadow-lg border border-border/50 p-6 flex flex-col items-center justify-center text-muted-foreground h-40 group hover:border-primary/50 transition-colors cursor-pointer">
                        <div className="p-3 bg-background rounded-full mb-3 group-hover:bg-primary/10 transition-colors">
                            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
                        </div>
                        <span className="text-sm font-medium">Väder Widget</span>
                    </div>

                    <div className="bg-card rounded-xl shadow-lg border border-border/50 p-6 flex flex-col items-center justify-center text-muted-foreground h-64 group hover:border-primary/50 transition-colors cursor-pointer">
                        <div className="p-3 bg-background rounded-full mb-3 group-hover:bg-primary/10 transition-colors">
                            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                        </div>
                        <span className="text-sm font-medium">Google Tasks</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
