'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getProjectsAction } from '@/app/actions';
import { logWorkAction } from '@/app/actions/log.actions';
import { Clock, Car, Check, Loader2 } from 'lucide-react';

export default function QuickLog() {
    const { user } = useAuth();
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // Form State
    const [projectId, setProjectId] = useState('');
    const [type, setType] = useState<'time' | 'mileage'>('time');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (user?.uid) {
            getProjectsAction(user.uid).then(res => {
                if (res.success && res.projects) {
                    setProjects(res.projects);
                }
            });
        }
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user?.uid || !projectId || !amount) return;

        setSubmitting(true);
        const res = await logWorkAction({
            projectId,
            userId: user.uid,
            type,
            amount: parseFloat(amount),
            description
        });

        setSubmitting(false);

        if (res.success) {
            setSuccess(true);
            setAmount('');
            setDescription('');
            // Reset success message after 3s
            setTimeout(() => setSuccess(false), 3000);
        } else {
            alert('Misslyckades att spara logg: ' + res.error);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Project Selector */}
            <div>
                <select
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-primary focus:border-primary"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    required
                >
                    <option value="">-- Välj Projekt --</option>
                    {projects.map(p => (
                        <option key={p.id} value={p.id}>
                            {p.projectNumber ? `${p.projectNumber} - ` : ''}{p.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Type Toggle */}
            <div className="flex rounded-md shadow-sm" role="group">
                <button
                    type="button"
                    onClick={() => setType('time')}
                    className={`flex-1 px-4 py-2 text-sm font-medium border rounded-l-lg flex items-center justify-center gap-2 transition-colors
                        ${type === 'time'
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-foreground border-border hover:bg-secondary'}`}
                >
                    <Clock size={16} />
                    Tid (h)
                </button>
                <button
                    type="button"
                    onClick={() => setType('mileage')}
                    className={`flex-1 px-4 py-2 text-sm font-medium border rounded-r-lg flex items-center justify-center gap-2 transition-colors
                        ${type === 'mileage'
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-foreground border-border hover:bg-secondary'}`}
                >
                    <Car size={16} />
                    Resa (km)
                </button>
            </div>

            {/* Inputs */}
            <div className="flex gap-2">
                <input
                    type="number"
                    step="0.5"
                    placeholder={type === 'time' ? "Antal timmar..." : "Antal km..."}
                    className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                />
            </div>

            <input
                type="text"
                placeholder="Beskrivning (valfritt)..."
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
            />

            {/* Submit */}
            <button
                type="submit"
                disabled={submitting || !projectId || !amount}
                className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all
                    ${success
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'btn-primary disabled:opacity-50 disabled:cursor-not-allowed'}`}
            >
                {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                ) : success ? (
                    <>
                        <Check size={16} />
                        Sparat!
                    </>
                ) : (
                    'Spara Logg'
                )}
            </button>
        </form>
    );
}
