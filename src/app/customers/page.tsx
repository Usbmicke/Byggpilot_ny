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

    useEffect(() => {
        if (user) loadCustomers();
    }, [user]);

    const loadCustomers = async () => {
        if (!user) return;
        setLoading(true);
        const res = await getCustomersAction(user.uid);
        if (res.success && res.customers) {
            setCustomers(res.customers);
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
                    <Link href="/dashboard" className="flex items-center text-slate-500 hover:text-slate-800 transition-colors mb-2">
                        <ArrowLeft size={16} className="mr-1" />
                        Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold text-slate-900">Kundregister</h1>
                    <p className="text-slate-500">Hantera dina kunder och se till att AI:n har rätt information.</p>
                </div>

                {/* Simple Quick Add */}
                <div className="flex gap-2 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
                    <input
                        type="text"
                        placeholder="Namn på ny kund..."
                        className="p-2 text-sm outline-none w-64"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                    />
                    <button
                        onClick={handleCreate}
                        disabled={isCreating || !newName.trim()}
                        className="bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2 text-sm font-medium">
                        <Plus size={16} /> Lägg till
                    </button>
                </div>
            </div>

            {/* List */}
            {loading ? (
                <div className="text-center py-20 text-slate-400 animate-pulse">Laddar kunder...</div>
            ) : customers.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <User size={48} className="mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-medium text-slate-700">Inga kunder än</h3>
                    <p className="text-slate-500">Lägg till din första kund ovan för att komma igång.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {customers.map((c) => (
                        <Link key={c.id} href={`/customers/${c.id}`} className="group">
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all relative">
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
                                        ${c.type === 'company' ? 'bg-blue-100 text-blue-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                        {c.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-slate-900 group-hover:text-indigo-700 transition-colors">{c.name}</h3>
                                        <span className="text-xs text-slate-400 capitalize">{c.type}</span>
                                    </div>
                                </div>

                                <div className="space-y-2 text-sm text-slate-600">
                                    <p className="flex items-center gap-2 truncate">
                                        <span className="text-slate-400 min-w-[60px]">Telefon:</span>
                                        {c.phone || <em className="text-amber-500/80 text-xs">Saknas</em>}
                                    </p>
                                    <p className="flex items-center gap-2 truncate">
                                        <span className="text-slate-400 min-w-[60px]">E-post:</span>
                                        {c.email || <em className="text-amber-500/80 text-xs">Saknas</em>}
                                    </p>
                                    <p className="flex items-center gap-2 truncate">
                                        <span className="text-slate-400 min-w-[60px]">Adress:</span>
                                        {c.address ? <span className="truncate">{c.address}</span> : <em className="text-amber-500/80 text-xs">Saknas</em>}
                                    </p>
                                </div>

                                {/* Progress Bar */}
                                <div className="mt-4 pt-4 border-t border-slate-100">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-slate-400">Profilkompletthet</span>
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
