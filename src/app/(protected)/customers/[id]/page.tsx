'use client';

import { useState, useEffect, use } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getCustomerAction, updateCustomerAction, deleteCustomerAction } from '@/app/actions';
import { useRouter } from 'next/navigation';
import { Save, Trash2, Building, User, Mail, Phone, MapPin, AlertCircle } from 'lucide-react';

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { user } = useAuth();
    const router = useRouter();

    const [customer, setCustomer] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        type: 'private' as 'private' | 'company',
        orgNumber: '',
        email: '',
        phone: '',
        address: ''
    });

    useEffect(() => {
        const load = async () => {
            if (!user) return;
            setLoading(true);
            const res = await getCustomerAction(id);
            if (res.success && res.customer) {
                setCustomer(res.customer);
                setFormData({
                    name: res.customer.name || '',
                    type: res.customer.type || 'private',
                    orgNumber: res.customer.orgNumber || '',
                    email: res.customer.email || '',
                    phone: res.customer.phone || '',
                    address: res.customer.address || ''
                });
            } else {
                setError(res.error || 'Kunden hittades inte.');
            }
            setLoading(false);
        };
        load();
    }, [id, user]);

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        const res = await updateCustomerAction(user.uid, id, formData);
        if (res.success) {
            router.refresh();
            // Show optimistic success or toast? For now just stay.
        } else {
            alert('Kunde inte spara: ' + res.error);
        }
        setSaving(false);
    };

    const handleDelete = async () => {
        if (!confirm('Är du säker på att du vill ta bort denna kund? Detta går inte att ångra.') || !user) return;
        setSaving(true);
        const res = await deleteCustomerAction(user.uid, id);
        if (res.success) {
            router.push('/customers');
        } else {
            alert('Kunde inte ta bort: ' + res.error);
            setSaving(false);
        }
    };

    if (loading) return <div className="p-10 text-center text-muted-foreground animate-pulse">Laddar kundinformation...</div>;
    if (error) return <div className="p-10 text-center text-red-500">{error}</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-6">
                <div className="flex items-center gap-4">
                    <div className={`h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-bold font-mono shadow-sm
                        ${formData.type === 'company' ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-800 text-zinc-300'}`}>
                        {formData.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground tracking-tight">{formData.name}</h1>
                        <p className="text-muted-foreground capitalize flex items-center gap-2">
                            {formData.type === 'company' ? <Building size={14} /> : <User size={14} />}
                            {formData.type === 'company' ? 'Företagskund' : 'Privatkund'}
                        </p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleDelete}
                        disabled={saving}
                        className="px-4 py-2 text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium border border-transparent hover:border-red-900/50"
                    >
                        <Trash2 size={16} /> Ta bort
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Save size={16} />
                        {saving ? 'Sparar...' : 'Spara ändringar'}
                    </button>
                </div>
            </div>

            {/* Main Form Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* Left Column: Basic Info */}
                <div className="space-y-6 bg-card p-6 rounded-xl border border-border shadow-sm">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <User size={18} className="text-primary" /> Grundinformation
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Namn</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full bg-zinc-900/50 border border-border rounded-lg px-4 py-2 text-foreground focus:ring-1 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all"
                                placeholder="Kundens namn"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Kundtyp</label>
                            <div className="flex bg-zinc-900/50 p-1 rounded-lg border border-border">
                                <button
                                    onClick={() => setFormData({ ...formData, type: 'private' })}
                                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${formData.type === 'private' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                                >
                                    Privat
                                </button>
                                <button
                                    onClick={() => setFormData({ ...formData, type: 'company' })}
                                    className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${formData.type === 'company' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                                >
                                    Företag
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Organisations-/Personnummer</label>
                            <input
                                type="text"
                                value={formData.orgNumber}
                                onChange={e => setFormData({ ...formData, orgNumber: e.target.value })}
                                className="w-full bg-zinc-900/50 border border-border rounded-lg px-4 py-2 text-foreground focus:ring-1 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all"
                                placeholder="XXXXXX-XXXX"
                            />
                        </div>
                    </div>
                </div>

                {/* Right Column: Contact Info */}
                <div className="space-y-6 bg-card p-6 rounded-xl border border-border shadow-sm">
                    <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                        <Mail size={18} className="text-primary" /> Kontaktuppgifter
                    </h3>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">E-postadress</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full bg-zinc-900/50 border border-border rounded-lg pl-10 pr-4 py-2 text-foreground focus:ring-1 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all"
                                    placeholder="namn@exempel.se"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Telefonnummer</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full bg-zinc-900/50 border border-border rounded-lg pl-10 pr-4 py-2 text-foreground focus:ring-1 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all"
                                    placeholder="070-123 45 67"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Faktura-/Postadress</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3 text-muted-foreground" size={16} />
                                <textarea
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full bg-zinc-900/50 border border-border rounded-lg pl-10 pr-4 py-2 text-foreground focus:ring-1 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all min-h-[100px] resize-none"
                                    placeholder="Gatuadress, Postnummer Ort"
                                />
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Info Banner */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 flex items-center gap-3 text-sm text-muted-foreground">
                <AlertCircle size={18} className="text-zinc-500" />
                <p>
                    Ändringar sparas direkt i databasen när du klickar på "Spara ändringar".
                    Kom ihåg att uppdatera projekten om kundens uppgifter ändras drastiskt.
                </p>
            </div>
        </div>
    );
}
