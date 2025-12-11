'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getCustomersAction, createCustomerAction } from '@/app/actions';
import Link from 'next/link';
import { Plus, User, AlertCircle, CheckCircle } from 'lucide-react';

export default function CustomersPage() {
    const { user } = useAuth();
    const [customers, setCustomers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newName, setNewName] = useState('');

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
        const res = await createCustomerAction(user.uid, { name: newName });
        if (res.success) {
            setNewName('');
            loadCustomers();
        } else {
            alert('Kunde inte skapa kund: ' + res.error);
        }
        setIsCreating(false);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Kundregister</h1>
                    <p className="text-muted-foreground mt-1">Hantera dina kunder och se till att AI:n har rätt information.</p>
                </div>

                {/* Improved Quick Action */}
                <Link
                    href="/customers/create"
                    className="btn-primary flex items-center gap-2 font-medium text-sm">
                    <Plus size={18} /> Ny Kund
                </Link>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-500 p-4 rounded-lg flex items-start gap-3">
                    <AlertCircle className="shrink-0 mt-0.5" size={18} />
                    <div>
                        <h3 className="font-semibold text-sm">Ett fel uppstod</h3>
                        <p className="text-sm opacity-90">{error}</p>
                        {error.includes('index') && (
                            <p className="mt-2 text-xs text-red-400">
                                💡 Detta beror oftast på att en databas-indexering saknas.
                                Håll utkik i server-konsolen/loggarna efter en URL som börjar med <code>https://console.firebase.google.com/...</code> och klicka på den för att skapa indexet.
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="text-center py-20 text-muted-foreground animate-pulse">Laddar kunder...</div>
            ) : customers.length === 0 ? (
                <div className="text-center py-20 bg-card rounded-xl border border-dashed border-border">
                    <User size={48} className="mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium text-foreground">Inga kunder än</h3>
                    <p className="text-muted-foreground">Lägg till din första kund ovan för att komma igång.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {customers.map((c) => (
                        <Link key={c.id} href={`/customers/${c.id}`} className="group">
                            <div className="bg-card p-6 rounded-xl border border-border shadow-sm hover:shadow-md hover:border-zinc-500 transition-all relative">
                                {/* Yellow Dot Indicator */}
                                {c.completeness < 80 ? (
                                    <div className="absolute top-4 right-4 text-amber-500" title="Information saknas (Gula Pricken)">
                                        <div className="w-3 h-3 bg-amber-400 rounded-full animate-pulse shadow-sm shadow-amber-200"></div>
                                    </div>
                                ) : (
                                    <div className="absolute top-4 right-4 text-emerald-400" title="Komplett">
                                        <CheckCircle size={16} />
                                    </div>
                                )}

                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold
                                        ${c.type === 'company' ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-800 text-zinc-300'}`}>
                                        {c.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-foreground group-hover:text-zinc-200 transition-colors">{c.name}</h3>
                                        <span className="text-xs text-muted-foreground capitalize">{c.type}</span>
                                    </div>
                                </div>

                                <div className="space-y-2 text-sm text-zinc-400">
                                    <p className="flex items-center gap-2 truncate">
                                        <span className="text-muted-foreground min-w-[60px]">Telefon:</span>
                                        {c.phone || <em className="text-amber-500/50 text-xs">Saknas</em>}
                                    </p>
                                    <p className="flex items-center gap-2 truncate">
                                        <span className="text-muted-foreground min-w-[60px]">E-post:</span>
                                        {c.email || <em className="text-amber-500/50 text-xs">Saknas</em>}
                                    </p>
                                    <p className="flex items-center gap-2 truncate">
                                        <span className="text-muted-foreground min-w-[60px]">Adress:</span>
                                        {c.address ? <span className="truncate">{c.address}</span> : <em className="text-amber-500/50 text-xs">Saknas</em>}
                                    </p>
                                </div>

                                {/* Progress Bar */}
                                <div className="mt-4 pt-4 border-t border-border">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-muted-foreground">Profilkompletthet</span>
                                        <span className={c.completeness < 80 ? 'text-amber-600 font-medium' : 'text-emerald-600 font-medium'}>
                                            {c.completeness}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-secondary rounded-full h-1.5">
                                        <div
                                            className={`h-1.5 rounded-full transition-all duration-500 ${c.completeness < 80 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                                            style={{ width: `${c.completeness}%` }}>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-xs text-zinc-400 group-hover:text-white font-medium opacity-0 group-hover:opacity-100 transition-all text-right">
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
