'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getCustomersAction, createCustomerAction } from '@/app/actions';
import Link from 'next/link';
import { Plus, User, AlertCircle, CheckCircle, Briefcase, Hammer } from 'lucide-react';

export default function CustomersPage() {
    const { user } = useAuth();
    const [customers, setCustomers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);

    // Create State
    const [newName, setNewName] = useState('');
    const [newType, setNewType] = useState<'private' | 'company' | 'subcontractor'>('private');

    // Filter State
    const [activeTab, setActiveTab] = useState<'all' | 'customers' | 'subcontractors'>('all');

    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user) loadCustomers();
    }, [user]);

    const loadCustomers = async () => {
        if (!user) return;
        setLoading(true);
        setError(null);
        const res = await getCustomersAction(user.uid);
        if (res.success && res.customers) {
            setCustomers(res.customers);
        } else {
            console.error(res.error);
            setError(res.error || 'Okänt fel vid hämtning av kunder.');
        }
        setLoading(false);
    };

    const handleCreate = async () => {
        if (!newName.trim() || !user) return;
        setIsCreating(true);

        // Auto-assign role for clarity if creating UE
        const role = newType === 'subcontractor' ? 'Underentreprenör' : undefined;

        const res = await createCustomerAction(user.uid, {
            name: newName,
            type: newType,
            role
        });

        if (res.success) {
            setNewName('');
            setNewType('private'); // Reset
            loadCustomers();
        } else {
            alert('Kunde inte skapa kontakt: ' + res.error);
        }
        setIsCreating(false);
    };

    // Filter Logic
    const filteredCustomers = customers.filter(c => {
        if (activeTab === 'all') return true;
        if (activeTab === 'customers') return c.type === 'private' || c.type === 'company';
        if (activeTab === 'subcontractors') return c.type === 'subcontractor';
        return true;
    });

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Kontaktbok & Kunder</h1>
                    <p className="text-muted-foreground mt-1">Hantera dina kunder och underentreprenörer på ett ställe.</p>
                </div>

                {/* Quick Create */}
                <div className="flex items-center gap-2 bg-card p-2 rounded-lg border border-border shadow-sm">
                    <select
                        className="bg-transparent text-sm border-none focus:ring-0 text-muted-foreground font-medium"
                        value={newType}
                        onChange={(e) => setNewType(e.target.value as any)}
                    >
                        <option value="private">Privatperson</option>
                        <option value="company">Företagskund</option>
                        <option value="subcontractor">Underentreprenör (UE)</option>
                    </select>
                    <div className="h-4 w-[1px] bg-border"></div>
                    <input
                        type="text"
                        placeholder="Namn..."
                        className="bg-transparent border-none text-sm focus:ring-0 w-32 md:w-48"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    />
                    <button
                        onClick={handleCreate}
                        disabled={!newName.trim() || isCreating}
                        className="btn-primary p-2 h-8 w-8 flex items-center justify-center rounded-md"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-border/50">
                <button
                    onClick={() => setActiveTab('all')}
                    className={`pb-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'all' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                    Alla Kontakter
                </button>
                <button
                    onClick={() => setActiveTab('customers')}
                    className={`pb-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'customers' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                    Kunder
                </button>
                <button
                    onClick={() => setActiveTab('subcontractors')}
                    className={`pb-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'subcontractors' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                    Underentreprenörer & Partners
                </button>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg flex items-start gap-3">
                    <AlertCircle className="shrink-0 mt-0.5" size={18} />
                    <div>
                        <h3 className="font-semibold text-sm">Ett fel uppstod</h3>
                        <p className="text-sm opacity-90">{error}</p>
                    </div>
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="text-center py-20 text-muted-foreground animate-pulse">Laddar kontakter...</div>
            ) : filteredCustomers.length === 0 ? (
                <div className="text-center py-20 bg-card rounded-xl border border-dashed border-border">
                    <User size={48} className="mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium text-foreground">Inga kontakter här</h3>
                    <p className="text-muted-foreground">Lägg till din första kontakt ovan.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredCustomers.map((c) => (
                        <Link key={c.id} href={`/customers/${c.id}`} className="group">
                            <div className="bg-card p-6 rounded-xl border border-border shadow-sm hover:shadow-md hover:border-zinc-500 transition-all relative">
                                {/* UE Badge */}
                                {c.type === 'subcontractor' && (
                                    <div className="absolute top-4 right-4 bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 text-xs rounded-full flex items-center gap-1">
                                        <Hammer size={10} /> UE
                                    </div>
                                )}

                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold
                                        ${c.type === 'subcontractor' ? 'bg-blue-900/50 text-blue-200' : 'bg-zinc-800 text-zinc-300'}`}>
                                        {c.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-foreground group-hover:text-zinc-200 transition-colors truncate max-w-[150px]">{c.name}</h3>
                                        <span className="text-xs text-muted-foreground capitalize">
                                            {c.role || (c.type === 'private' ? 'Privatperson' : c.type === 'company' ? 'Företag' : 'Partner')}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2 text-sm text-zinc-400">
                                    <p className="flex items-center gap-2 truncate">
                                        <span className="text-muted-foreground min-w-[60px]">Telefon:</span>
                                        {c.phone || <em className="text-amber-500/50 text-xs">-</em>}
                                    </p>
                                    <p className="flex items-center gap-2 truncate">
                                        <span className="text-muted-foreground min-w-[60px]">E-post:</span>
                                        {c.email || <em className="text-amber-500/50 text-xs">-</em>}
                                    </p>
                                </div>

                                {/* Progress Bar / Edit Hint */}
                                <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                                    <div className="text-xs text-zinc-500">
                                        {c.completeness}% ifylld
                                    </div>
                                    <div className="text-xs text-zinc-400 group-hover:text-primary font-medium transition-colors">
                                        Redigera &rarr;
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
