'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getChangeOrdersAction, createChangeOrderAction, approveChangeOrderAction } from '@/app/actions';
import { ArrowLeft, Plus, CheckCircle, XCircle, Clock, FileText } from 'lucide-react';

// Simple Badge Component
const StatusBadge = ({ status }: { status: string }) => {
    const colors: any = {
        draft: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        approved: 'bg-green-500/20 text-green-400 border-green-500/30',
        rejected: 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    const labels: any = { draft: 'Utkast', approved: 'Godkänd', rejected: 'Nekad' };

    return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${colors[status] || colors.draft}`}>
            {labels[status] || status}
        </span>
    );
};

export default function AtaPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.id as string;

    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        description: '',
        type: 'material',
        quantity: 1,
        unit: 'tim',
        estimatedCost: 0
    });

    useEffect(() => {
        loadData();
    }, [projectId]);

    const loadData = async () => {
        setLoading(true);
        const res = await getChangeOrdersAction(projectId);
        if (res.success) {
            setOrders(res.orders || []);
        }
        setLoading(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        const res = await createChangeOrderAction({
            projectId,
            ...formData,
            type: formData.type as any
        });

        if (res.success) {
            setShowModal(false);
            setFormData({ description: '', type: 'material', quantity: 1, unit: 'tim', estimatedCost: 0 }); // Reset
            loadData(); // Refresh
        } else {
            alert("Fel vid skapande: " + res.error);
        }
        setSubmitting(false);
    };

    const handleApprove = async (id: string, approved: boolean) => {
        if (!confirm(`Är du säker på att du vill ${approved ? 'GODKÄNNA' : 'NEKA'} denna ÄTA?`)) return;

        const res = await approveChangeOrderAction(id, approved);
        if (res.success) {
            loadData();
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 max-w-4xl mx-auto">
                <button onClick={() => router.back()} className="flex items-center text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Tillbaka
                </button>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                    Ändringar & Tillägg (ÄTA)
                </h1>
            </div>

            <div className="max-w-4xl mx-auto">
                {/* Actions */}
                <div className="flex justify-end mb-6">
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg shadow-blue-900/20 transition-all active:scale-95"
                    >
                        <Plus className="w-5 h-5 mr-2" />
                        Ny ÄTA
                    </button>
                </div>

                {/* List */}
                {loading ? (
                    <div className="text-center text-slate-500 py-12">Laddar ÄTA-ärenden...</div>
                ) : orders.length === 0 ? (
                    <div className="text-center bg-slate-900/50 border border-slate-800 rounded-2xl p-12">
                        <Clock className="w-12 h-12 mx-auto text-slate-600 mb-4" />
                        <h3 className="text-lg font-medium text-slate-300">Inga ändringar än</h3>
                        <p className="text-slate-500 mt-2">Tryck på "Ny ÄTA" för att registrera extraarbete.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {orders.map((order) => (
                            <div key={order.id} className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-sm hover:border-slate-700 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <StatusBadge status={order.status} />
                                        <span className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleDateString()}</span>
                                    </div>
                                    <h3 className="text-lg font-semibold text-white mb-1">{order.description}</h3>
                                    <div className="text-slate-400 text-sm flex gap-4">
                                        <span>{order.quantity} {order.unit} x {Math.round(order.estimatedCost / order.quantity)} kr</span>
                                        <span className="text-slate-600">|</span>
                                        <span className="text-emerald-400 font-medium">Totalt: {order.estimatedCost} kr</span>
                                    </div>
                                </div>

                                {/* Actions for Drafts */}
                                {order.status === 'draft' && (
                                    <div className="flex gap-2 shrink-0">
                                        <button
                                            onClick={() => handleApprove(order.id, false)}
                                            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Neka"
                                        >
                                            <XCircle className="w-6 h-6" />
                                        </button>
                                        <button
                                            onClick={() => handleApprove(order.id, true)}
                                            className="p-2 text-green-400 hover:bg-green-500/10 rounded-lg transition-colors" title="Godkänn / Skicka"
                                        >
                                            <CheckCircle className="w-6 h-6" />
                                        </button>
                                    </div>
                                )}
                                {order.status === 'approved' && (
                                    <div className="flex items-center gap-2 shrink-0">
                                        {/* Status */}
                                        <div className="text-green-500 flex items-center gap-1">
                                            <CheckCircle className="w-5 h-5" />
                                            <span className="text-sm hidden sm:inline">Signerad</span>
                                        </div>

                                        {/* PDF Link */}
                                        {order.driveWebViewLink && (
                                            <a
                                                href={order.driveWebViewLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                                                title="Öppna PDF Underlag"
                                            >
                                                <FileText className="w-6 h-6" />
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* CREATE MODAL */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
                        <h2 className="text-xl font-bold text-white mb-4">Skapa ny ÄTA</h2>

                        {/* VOICE INPUT REMOVED - Using Chat Agent instead */}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Beskrivning</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="T.ex. Montering extra eluttag"
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Typ</label>
                                    <select
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none"
                                        value={formData.type}
                                        onChange={e => setFormData({ ...formData, type: e.target.value })}
                                    >
                                        <option value="material">Material</option>
                                        <option value="work">Arbete</option>
                                        <option value="other">Övrigt</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Antal</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none"
                                        value={formData.quantity}
                                        onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Enhet</label>
                                    <input
                                        type="text"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none"
                                        value={formData.unit}
                                        onChange={e => setFormData({ ...formData, unit: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-400 mb-1">Total Kostnad (ex moms)</label>
                                    <input
                                        type="number"
                                        required
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none"
                                        value={formData.estimatedCost}
                                        onChange={e => setFormData({ ...formData, estimatedCost: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-6 pt-4 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 text-slate-400 hover:text-white transition-colors"
                                >
                                    Avbryt
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-4 py-2 font-medium disabled:opacity-50"
                                >
                                    {submitting ? 'Sparar...' : 'Spara ÄTA'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
