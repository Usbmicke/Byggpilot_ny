'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getCustomersAction, updateCustomerAction } from '@/app/actions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, User, Building, Phone, Mail, MapPin, Hash, Save, Trash } from 'lucide-react';

export default function EditCustomerPage({ params }: { params: { id: string } }) {
    const { user } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [customer, setCustomer] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');

    useEffect(() => {
        if (user && params.id) loadCustomer();
    }, [user, params.id]);

    const loadCustomer = async () => {
        setLoading(true);
        // We reuse getCustomersAction and find by ID for simplicity in this MVP
        // In a larger app we would have a specific getCustomerAction(id)
        if (!user) return;
        const res = await getCustomersAction(user.uid);
        if (res.success && res.customers) {
            const found = res.customers.find((c: any) => c.id === params.id);
            if (found) setCustomer(found);
            else setMsg('Kunden hittades inte.');
        }
        setLoading(false);
    };

    const handleSave = async () => {
        if (!user || !customer) return;
        setSaving(true);
        setMsg('');

        const res = await updateCustomerAction(user.uid, customer.id, {
            name: customer.name,
            type: customer.type,
            orgNumber: customer.orgNumber,
            email: customer.email,
            phone: customer.phone,
            address: customer.address,
            notes: customer.notes
        });

        setSaving(false);
        if (res.success) {
            setMsg('✅ Ändringar sparade.');
            setTimeout(() => setMsg(''), 3000);
            // Reload to recalc completeness (done on server during update)
            loadCustomer();
        } else {
            setMsg('❌ Fel vid sparning: ' + res.error);
        }
    };

    if (loading) return <div className="p-10 text-center animate-pulse text-slate-400">Laddar kunddata...</div>;
    if (!customer) return <div className="p-10 text-center">Kunden hittades inte. <Link href="/customers" className="underline">Tillbaka</Link></div>;

    return (
        <div className="p-8 max-w-3xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <Link href="/customers" className="flex items-center text-slate-500 hover:text-slate-800 transition-colors">
                    <ArrowLeft size={20} className="mr-2" />
                    Tillbaka till registret
                </Link>
                {msg && <span className={`${msg.includes('✅') ? 'text-emerald-600' : 'text-red-500'} font-medium animate-in fade-in`}>{msg}</span>}
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                {/* Header/Cover */}
                <div className="h-32 bg-slate-900 flex items-end p-6">
                    <div className="flex items-center gap-4 translate-y-8">
                        <div className="w-20 h-20 rounded-xl bg-white shadow-md flex items-center justify-center text-3xl font-bold text-slate-800 border-4 border-white">
                            {customer.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="mb-6">
                            <h1 className="text-2xl font-bold text-white">{customer.name}</h1>
                            <span className="text-slate-300 text-sm bg-white/10 px-2 py-0.5 rounded backdrop-blur-sm">
                                {customer.type === 'company' ? 'Företagskund' : 'Privatkund'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="p-8 pt-12 space-y-6">
                    {/* Completeness Alert */}
                    {customer.completeness < 80 && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg flex gap-3 items-start">
                            <AlertCircle className="shrink-0 mt-0.5" size={18} />
                            <div>
                                <h3 className="font-semibold text-sm">Information saknas</h3>
                                <p className="text-sm opacity-90 mt-1">
                                    För att automatiska avtal och AI-funktioner ska fungera optimalt bör du fylla i <strong>Adress</strong> och <strong>Org/Personnummer</strong>.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-slate-700">Namn</label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    className="input-field w-full pl-10 p-2.5 bg-slate-50 border rounded focus:bg-white"
                                    value={customer.name}
                                    onChange={e => setCustomer({ ...customer, name: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-slate-700">Kundtyp</label>
                            <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-200 overflow-hidden">
                                <button
                                    onClick={() => setCustomer({ ...customer, type: 'private' })}
                                    className={`flex-1 py-2 text-sm font-medium rounded transition-colors flex items-center justify-center gap-2 ${customer.type === 'private' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
                                    <User size={16} /> Privat
                                </button>
                                <button
                                    onClick={() => setCustomer({ ...customer, type: 'company' })}
                                    className={`flex-1 py-2 text-sm font-medium rounded transition-colors flex items-center justify-center gap-2 ${customer.type === 'company' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}>
                                    <Building size={16} /> Företag
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-slate-700">Org.nr / Personnummer</label>
                            <div className="relative">
                                <Hash className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    className="input-field w-full pl-10 p-2.5 bg-slate-50 border rounded focus:bg-white"
                                    value={customer.orgNumber}
                                    onChange={e => setCustomer({ ...customer, orgNumber: e.target.value })}
                                    placeholder={customer.type === 'company' ? '556XXX-XXXX' : 'ÅÅMMDD-XXXX'}
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <label className="block text-sm font-medium text-slate-700">Telefon</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    className="input-field w-full pl-10 p-2.5 bg-slate-50 border rounded focus:bg-white"
                                    value={customer.phone}
                                    onChange={e => setCustomer({ ...customer, phone: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-4 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700">E-post</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                                <input
                                    type="email"
                                    className="input-field w-full pl-10 p-2.5 bg-slate-50 border rounded focus:bg-white"
                                    value={customer.email}
                                    onChange={e => setCustomer({ ...customer, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-4 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700">Adress (Gata, Postnr, Ort)</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3 text-slate-400" size={18} />
                                <textarea
                                    className="input-field w-full pl-10 p-2.5 bg-slate-50 border rounded focus:bg-white min-h-[100px]"
                                    value={customer.address}
                                    onChange={e => setCustomer({ ...customer, address: e.target.value })}
                                    placeholder="Storgatan 1&#10;123 45 Staden"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
                        <button
                            className="px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded transition-colors flex items-center gap-2 opacity-50 hover:opacity-100"
                            title="Ta bort kund (Ej implementerat i demo)"
                            disabled
                        >
                            <Trash size={18} /> Ta bort
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg shadow-md hover:bg-indigo-700 transition-all flex items-center gap-2 font-medium"
                        >
                            {saving ? 'Sparar...' : <><Save size={18} /> Spara Ändringar</>}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function AlertCircle({ size, className }: any) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
    )
}
