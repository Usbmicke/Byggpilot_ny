'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getProjectsAction, createProjectAction } from '@/app/actions';
import { Plus } from 'lucide-react'; // Ensure lucide-react is available (usually is in shadcn setups)

// Simple Modal Component (Inline for speed, can extract later)
function CreateProjectModal({ isOpen, onClose, onCreated, ownerId }: any) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        customerName: '',
        description: ''
    });

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                <h2 className="text-xl font-bold mb-4 text-gray-900">Nytt Projekt</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Projektnamn</label>
                        <input
                            required
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            placeholder="t.ex. Villa Svensson"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Adress</label>
                        <input
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            value={formData.address}
                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Kund</label>
                        <input
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            value={formData.customerName}
                            onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Beskrivning</label>
                        <textarea
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                        />
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">Avbryt</button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
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
                    <h1 className="text-2xl font-bold text-gray-900">Mina Projekt</h1>
                    <p className="text-gray-500">Hantera dina pågående och avslutade jobb.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <Plus size={20} />
                    Nytt Projekt
                </button>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-48 bg-gray-200 rounded-xl animate-pulse"></div>
                    ))}
                </div>
            ) : projects.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                    <h3 className="text-lg font-medium text-gray-900">Inga projekt än</h3>
                    <p className="text-gray-500 mb-6">Skapa ditt första projekt för att komma igång.</p>
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
                        <div key={project.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="h-10 w-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-bold text-lg">
                                    {project.name.charAt(0).toUpperCase()}
                                </div>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${project.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                    }`}>
                                    {project.status === 'active' ? 'Pågående' : project.status}
                                </span>
                            </div>
                            <h3 className="font-semibold text-gray-900 text-lg mb-1 group-hover:text-indigo-600 transition-colors">{project.name}</h3>
                            <p className="text-sm text-gray-500 mb-4 line-clamp-2">{project.description || 'Ingen beskrivning'}</p>

                            <div className="space-y-2 text-xs text-gray-500">
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
                                <div className="pt-3 border-t border-gray-100 mt-4 flex justify-between items-center">
                                    <span>Skapad {new Date(project.createdAt).toLocaleDateString('sv-SE')}</span>
                                    {/* Placeholder for future actions */}
                                    <span className="text-gray-300">Mer info &rarr;</span>
                                </div>
                            </div>
                        </div>
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
