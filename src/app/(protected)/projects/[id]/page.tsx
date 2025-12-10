'use client';

import { useState, useEffect, use } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getProjectAction, updateProjectAction, deleteProjectAction } from '@/app/actions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Folder, MapPin, User, Save, Trash, X, FileText } from 'lucide-react';

export default function ProjectDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [project, setProject] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');

    // Delete Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = useState('');
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (user && id) loadProject();
    }, [user, id]);

    const loadProject = async () => {
        setLoading(true);
        if (!user) return;
        const res = await getProjectAction(id);
        if (res.success && res.project) {
            setProject(res.project);
        } else {
            setMsg('Projektet hittades inte.');
        }
        setLoading(false);
    };

    const handleSave = async () => {
        if (!user || !project) return;
        setSaving(true);
        setMsg('');

        const res = await updateProjectAction(project.id, {
            name: project.name,
            projectNumber: project.projectNumber,
            address: project.address,
            description: project.description,
            status: project.status
        });

        setSaving(false);
        if (res.success) {
            setMsg('✅ Ändringar sparade.');
            setTimeout(() => setMsg(''), 3000);
        } else {
            setMsg('❌ Fel vid sparning: ' + res.error);
        }
    };

    const handleDelete = async () => {
        if (!user || !project) return;
        if (deleteConfirmation !== 'RADERA') return;

        setDeleting(true);
        const res = await deleteProjectAction(project.id);
        if (res.success) {
            router.push('/projects');
        } else {
            setMsg('❌ Kunde inte radera: ' + res.error);
            setShowDeleteModal(false);
        }
        setDeleting(false);
    };

    if (loading) return <div className="p-10 text-center animate-pulse text-muted-foreground">Laddar projekt...</div>;
    if (!project) return <div className="p-10 text-center">Projektet hittades inte. <Link href="/projects" className="underline">Tillbaka</Link></div>;

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8 relative">
            {/* Delete Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                                <Trash size={20} className="text-red-500" /> Radera Projekt?
                            </h3>
                            <button onClick={() => setShowDeleteModal(false)} className="text-muted-foreground hover:text-foreground">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <p className="text-muted-foreground">
                                Är du säker på att du vill radera <strong>{project.name}</strong>?
                                Detta går inte att ångra.
                            </p>

                            <div className="space-y-2">
                                <label className="text-xs uppercase font-bold text-muted-foreground">Skriv "RADERA" för att bekräfta</label>
                                <input
                                    type="text"
                                    value={deleteConfirmation}
                                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                                    placeholder="RADERA"
                                    className="input-field w-full"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className="flex-1 py-2.5 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 font-medium transition-colors"
                                >
                                    Avbryt
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={deleteConfirmation !== 'RADERA' || deleting}
                                    className="flex-1 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                                >
                                    {deleting ? 'Raderar...' : 'Radera Projekt'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between">
                <Link href="/projects" className="flex items-center text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft size={20} className="mr-2" />
                    Tillbaka till projekt
                </Link>
                {msg && <span className={`${msg.includes('✅') ? 'text-emerald-500' : 'text-red-500'} font-medium animate-in fade-in`}>{msg}</span>}
            </div>

            <div className="bg-card rounded-xl shadow-lg border border-border overflow-hidden">
                <div className="h-32 bg-primary/5 flex items-end p-6 border-b border-border">
                    <div className="flex items-center gap-4 translate-y-8">
                        <div className="w-20 h-20 rounded-xl bg-card shadow-md flex items-center justify-center text-3xl font-bold text-primary border-4 border-card">
                            {project.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="mb-6">
                            <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
                            <span className={`text-xs px-2 py-0.5 rounded-full border ${project.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-secondary text-muted-foreground border-border'}`}>
                                {project.status === 'active' ? 'Pågående' : project.status}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="p-8 pt-12 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-muted-foreground">Projektnamn</label>
                            <div className="relative">
                                <Folder className="absolute left-3 top-3 text-muted-foreground" size={18} />
                                <input
                                    type="text"
                                    className="input-field w-full pl-10"
                                    value={project.name}
                                    onChange={e => setProject({ ...project, name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-muted-foreground">Projektnummer</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-muted-foreground font-mono text-sm">#</span>
                                <input
                                    type="number"
                                    className="input-field w-full pl-8 font-mono"
                                    value={project.projectNumber || ''}
                                    onChange={e => setProject({ ...project, projectNumber: parseInt(e.target.value) || 0 })}
                                    placeholder="3000"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-muted-foreground">Status</label>
                            <select
                                className="input-field w-full appearance-none"
                                value={project.status}
                                onChange={e => setProject({ ...project, status: e.target.value })}
                            >
                                <option value="active">Pågående</option>
                                <option value="completed">Avslutad</option>
                                <option value="paused">Pausad</option>
                            </select>
                        </div>

                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-muted-foreground">Adress</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3 text-muted-foreground" size={18} />
                                <input
                                    type="text"
                                    className="input-field w-full pl-10"
                                    value={project.address || ''}
                                    onChange={e => setProject({ ...project, address: e.target.value })}
                                    placeholder="Adress"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-muted-foreground">Kund</label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 text-muted-foreground" size={18} />
                                <input
                                    type="text"
                                    className="input-field w-full pl-10 disabled:opacity-60"
                                    value={project.customerName || ''}
                                    disabled
                                    title="Kund kan inte ändras här än"
                                />
                            </div>
                        </div>

                        <div className="space-y-4 md:col-span-2">
                            <label className="block text-sm font-medium text-muted-foreground">Beskrivning</label>
                            <div className="relative">
                                <FileText className="absolute left-3 top-3 text-muted-foreground" size={18} />
                                <textarea
                                    className="input-field w-full pl-10 resize-none min-h-[100px]"
                                    value={project.description || ''}
                                    onChange={e => setProject({ ...project, description: e.target.value })}
                                    placeholder="Beskrivning av projektet..."
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-border flex justify-end gap-3">
                        <button
                            onClick={() => setShowDeleteModal(true)}
                            className="px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <Trash size={18} /> Ta bort
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="btn-primary flex items-center gap-2"
                        >
                            {saving ? 'Sparar...' : <><Save size={18} /> Spara Ändringar</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
