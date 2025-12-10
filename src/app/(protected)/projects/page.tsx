'use client';

import { startTransition, useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { getProjectsAction, createProjectAction } from '@/app/actions';
import { Plus } from 'lucide-react'; // Ensure lucide-react is available (usually is in shadcn setups)
import { WeatherWidget } from '@/components/projects/WeatherWidget';

// Simple Modal Component (Inline for speed, can extract later)
function ProjectRiskIndicator({ projectId }: { projectId: string }) {
    const [risks, setRisks] = useState<any[]>([]);

    useEffect(() => {
        import('@/app/actions').then((mod: any) => {
            if (mod.getRisksAction) {
                mod.getRisksAction(projectId).then((res: any) => {
                    if (res.success && res.risks) setRisks(res.risks);
                });
            }
        });
    }, [projectId]);

    if (risks.length === 0) return null;

    return (
        <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
            ⚠️ {risks.length} Risk{risks.length > 1 ? 'er' : ''}
        </span>
    );
}

function CreateProjectModal({ isOpen, onClose, onCreated, ownerId }: any) {
    const [loading, setLoading] = useState(false);
    const [customers, setCustomers] = useState<any[]>([]);
    const [useExistingCustomer, setUseExistingCustomer] = useState(true);

    // Load customers on open
    useEffect(() => {
        if (isOpen && ownerId) {
            import('@/app/actions').then(({ getCustomersAction }) => {
                getCustomersAction(ownerId).then(res => {
                    if (res.success && res.customers) setCustomers(res.customers);
                });
            });
        }
    }, [isOpen, ownerId]);

    const [formData, setFormData] = useState({
        name: '',
        address: '',
        customerName: '',
        customerId: '',
        description: ''
    });

    // Auto-fill address/name when customer is selected
    const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const cId = e.target.value;
        const customer = customers.find(c => c.id === cId);
        if (customer) {
            setFormData(prev => ({
                ...prev,
                customerId: customer.id,
                customerName: customer.name,
                address: customer.address || prev.address // Fill address if available
            }));
        } else {
            setFormData(prev => ({ ...prev, customerId: '', customerName: '' }));
        }
    };

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const res = await createProjectAction({ ...formData, ownerId });
        setLoading(false);
        if (res.success) {
            onCreated();
            onClose();
        } else {
            alert('Fel vid skapande: ' + res.error);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-card rounded-xl shadow-xl p-6 w-full max-w-md animate-in fade-in zoom-in-95 duration-200 border border-border">
                <h2 className="text-xl font-bold mb-4 text-foreground">Nytt Projekt</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Projektnamn</label>
                        <input
                            required
                            className="input-field"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="t.ex. Takbyte 2024"
                        />
                    </div>

                    {/* Customer Selection */}
                    <div className="bg-secondary/20 p-3 rounded-lg border border-border/50">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-medium text-foreground">Kund</label>
                            <button
                                type="button"
                                onClick={() => setUseExistingCustomer(!useExistingCustomer)}
                                className="text-xs text-primary hover:underline"
                            >
                                {useExistingCustomer ? '+ Skapa ny / Manuell' : 'Välj befintlig'}
                            </button>
                        </div>

                        {useExistingCustomer ? (
                            <select
                                className="input-field"
                                value={formData.customerId}
                                onChange={handleCustomerSelect}
                            >
                                <option value="">-- Välj Kund --</option>
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                className="input-field"
                                value={formData.customerName}
                                onChange={e => setFormData({ ...formData, customerName: e.target.value, customerId: '' })}
                                placeholder="Kundnamn"
                            />
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Adress</label>
                        <input
                            className="input-field"
                            value={formData.address}
                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Beskrivning</label>
                        <textarea
                            className="input-field resize-none"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            placeholder="Vad ska göras? (Detta analyseras för risker)"
                        />
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:bg-background rounded-md transition-colors">Avbryt</button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 text-sm btn-primary disabled:opacity-50"
                        >
                            {loading ? 'Skapar...' : 'Skapa Projekt'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function ProjectsPage() {
    const { user } = useAuth();
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const fetchProjects = async () => {
        if (!user?.uid) return;
        setLoading(true);
        const res = await getProjectsAction(user.uid);
        if (res.success && res.projects) {
            setProjects(res.projects);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchProjects();
    }, [user]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Mina Projekt</h1>
                    <p className="text-muted-foreground">Hantera dina pågående och avslutade jobb.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 btn-primary transition-colors shadow-sm"
                >
                    <Plus size={20} />
                    Nytt Projekt
                </button>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-48 bg-card/50 rounded-xl animate-pulse border border-border"></div>
                    ))}
                </div>
            ) : projects.length === 0 ? (
                <div className="text-center py-20 bg-card rounded-xl border border-dashed border-border">
                    <h3 className="text-lg font-medium text-foreground">Inga projekt än</h3>
                    <p className="text-muted-foreground mb-6">Skapa ditt första projekt för att komma igång.</p>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="text-indigo-600 font-medium hover:underline"
                    >
                        Skapa ett nu &rarr;
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {projects.map((project) => (
                        <Link href={`/projects/${project.id}`} key={project.id} className="block bg-card p-6 rounded-xl border border-border shadow-sm hover:shadow-md transition-all group hover:border-primary/50">
                            <div className="flex justify-between items-start mb-4">
                                <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary font-bold text-lg">
                                    {project.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${project.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-secondary text-muted-foreground'
                                        }`}>
                                        {project.status === 'active' ? 'Pågående' : project.status}
                                    </span>
                                    {project.projectNumber && (
                                        <span className="text-xs font-mono text-muted-foreground">
                                            #{project.projectNumber}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <h3 className="font-semibold text-foreground text-lg mb-1 group-hover:text-primary transition-colors">{project.name}</h3>
                            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{project.description || 'Ingen beskrivning'}</p>

                            <div className="space-y-2 text-xs text-muted-foreground">
                                {project.address && (
                                    <div className="flex items-center gap-1">
                                        📍 {project.address}
                                    </div>
                                )}
                                {project.customerName && (
                                    <div className="flex items-center gap-1">
                                        👤 {project.customerName}
                                    </div>
                                )}
                                <div className="pt-3 border-t border-border mt-4 flex justify-between items-center">
                                    <span>Skapad {new Date(project.createdAt).toLocaleDateString('sv-SE')}</span>
                                    {/* Risk Indicator (The Putter) */}
                                    <ProjectRiskIndicator projectId={project.id} />
                                    {/* Weather Widget (Phase 9) */}
                                    <div className="mt-2 w-full">
                                        <WeatherWidget address={project.address} projectId={project.id} />
                                    </div>

                                    {/* Placeholder for future actions */}
                                    <span className="text-primary/50 group-hover:text-primary transition-colors">Mer info &rarr;</span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            <CreateProjectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onCreated={fetchProjects}
                ownerId={user?.uid}
            />
        </div>
    );
}
