'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getProjectsAction } from '@/app/actions'; // Reuse existing action
import { FinalInvoiceModal } from '@/components/invoice/FinalInvoiceModal';
import { FileText, DollarSign, TrendingUp } from 'lucide-react';

export default function EconomyPage() {
    const { user } = useAuth();
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal State
    const [selectedProject, setSelectedProject] = useState<any>(null);

    useEffect(() => {
        if (user?.uid) {
            getProjectsAction(user.uid).then(res => {
                if (res.success && res.projects) {
                    setProjects(res.projects);
                }
                setLoading(false);
            });
        }
    }, [user]);

    // Filter for Active Projects mostly? Or all.
    const activeProjects = projects.filter(p => p.status !== 'completed');

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
                    <DollarSign className="text-emerald-500" size={32} />
                    Ekonomi & Fakturering
                </h1>
                <p className="text-muted-foreground mt-2">
                    Fakturera dina jobb tryggt och säkert. Här har du full kontroll.
                </p>
            </div>

            {/* Quick Stats (Placeholder) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Pågående Jobb</p>
                            <h3 className="text-2xl font-bold">{activeProjects.length}</h3>
                        </div>
                    </div>
                </div>
                {/* Add more stats later */}
            </div>

            {/* Project List */}
            <div className="space-y-4">
                <h2 className="text-xl font-bold text-foreground">Projekt att fakturera</h2>

                {loading ? (
                    <div className="h-32 bg-secondary/30 animate-pulse rounded-xl"></div>
                ) : activeProjects.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-border rounded-xl">
                        <p className="text-muted-foreground">Inga aktiva projekt att fakturera just nu.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {activeProjects.map(project => (
                            <div key={project.id} className="bg-card rounded-xl border border-border shadow-sm p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
                                <div className="mb-4">
                                    <div className="flex justify-between items-start">
                                        <h3 className="text-lg font-bold text-foreground">{project.name}</h3>
                                        <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-full font-medium">
                                            {project.status === 'active' ? 'Pågående' : project.status}
                                        </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{project.customerName || 'Ingen kund angiven'}</p>
                                    <div className="mt-2 text-xs text-muted-foreground flex gap-3">
                                        <span>#{project.projectNumber || 'N/A'}</span>
                                        <span>•</span>
                                        <span>{project.address || 'Ingen adress'}</span>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-border flex justify-end">
                                    <button
                                        onClick={() => setSelectedProject(project)}
                                        className="btn-primary bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 shadow-lg"
                                    >
                                        <FileText size={18} className="mr-2 inline" />
                                        Fakturera Projekt
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {selectedProject && (
                <FinalInvoiceModal
                    isOpen={!!selectedProject}
                    onClose={() => setSelectedProject(null)}
                    projectId={selectedProject.id}
                    projectTitle={selectedProject.name}
                    customerEmail={selectedProject.customerEmail} // Ensure Repo returns this!
                />
            )}
        </div>
    );
}
