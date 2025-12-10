'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getCustomersAction, createCustomerAction } from '@/app/actions';
import Link from 'next/link';
import { ArrowLeft, Plus, User, AlertCircle, CheckCircle } from 'lucide-react';

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
        <div className="p-8 max-w-5xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <Link href="/dashboard" className="flex items-center text-slate-400 hover:text-white transition-colors mb-2">
                        <ArrowLeft size={16} className="mr-1" />
                        Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold text-white">Kundregister</h1>
                    <p className="text-slate-400">Hantera dina kunder och se till att AI:n har rätt information.</p>
                </div>

                {/* Improved Quick Action */}
                <Link
                    href="/customers/create"
                    className="bg-slate-900 text-white px-6 py-2.5 rounded-lg hover:bg-slate-800 shadow-md transition-all flex items-center gap-2 font-medium text-sm">
                    <Plus size={18} /> Ny Kund
                </Link>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-lg flex items-start gap-3">
                    <AlertCircle className="shrink-0 mt-0.5" size={18} />
                    <div>
                        <h3 className="font-semibold text-sm">Ett fel uppstod</h3>
                        <p className="text-sm opacity-90">{error}</p>
                        {error.includes('index') && (
                            <p className="mt-2 text-xs text-red-300">
                                💡 Detta beror oftast på att en databas-indexering saknas.
                                Håll utkik i server-konsolen/loggarna efter en URL som börjar med <code>https://console.firebase.google.com/...</code> och klicka på den för att skapa indexet.
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="text-center py-20 text-slate-500 animate-pulse">Laddar kunder...</div>
            ) : customers.length === 0 ? (
                <div className="text-center py-20 bg-slate-900 rounded-xl border border-dashed border-slate-800">
                    <User size={48} className="mx-auto text-slate-500 mb-4" />
                    <h3 className="text-lg font-medium text-slate-200">Inga kunder än</h3>
                    <p className="text-slate-400">Lägg till din första kund ovan för att komma igång.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {customers.map((c) => (
                        <Link key={c.id} href={`/customers/${c.id}`} className="group">
                            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-sm hover:shadow-md hover:border-indigo-500 transition-all relative">
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
                                        ${c.type === 'company' ? 'bg-blue-900/30 text-blue-400' : 'bg-indigo-900/30 text-indigo-400'}`}>
                                        {c.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors">{c.name}</h3>
                                        <span className="text-xs text-slate-500 capitalize">{c.type}</span>
                                    </div>
                                </div>

                                <div className="space-y-2 text-sm text-slate-400">
                                    <p className="flex items-center gap-2 truncate">
                                        <span className="text-slate-500 min-w-[60px]">Telefon:</span>
                                        {c.phone || <em className="text-amber-500/50 text-xs">Saknas</em>}
                                    </p>
                                    <p className="flex items-center gap-2 truncate">
                                        <span className="text-slate-500 min-w-[60px]">E-post:</span>
                                        {c.email || <em className="text-amber-500/50 text-xs">Saknas</em>}
                                    </p>
                                    <p className="flex items-center gap-2 truncate">
                                        <span className="text-slate-500 min-w-[60px]">Adress:</span>
                                        {c.address ? <span className="truncate">{c.address}</span> : <em className="text-amber-500/50 text-xs">Saknas</em>}
                                    </p>
                                </div>

                                {/* Progress Bar */}
                                <div className="mt-4 pt-4 border-t border-slate-800">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-slate-500">Profilkompletthet</span>
                                        <span className={c.completeness < 80 ? 'text-amber-600 font-medium' : 'text-emerald-600 font-medium'}>
                                            {c.completeness}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                                        <div
                                            className={`h-1.5 rounded-full transition-all duration-500 ${c.completeness < 80 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                                            style={{ width: `${c.completeness}%` }}>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-xs text-indigo-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity text-right">
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
