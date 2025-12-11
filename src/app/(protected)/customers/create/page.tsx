'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { createCustomerAction } from '@/app/actions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Save, User, Mail, Phone, MapPin, Building, ArrowLeft } from 'lucide-react';

export default function CreateCustomerPage() {
    const { user } = useAuth();
    const router = useRouter();

    const [saving, setSaving] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        type: 'private' as 'private' | 'company',
        orgNumber: '',
        email: '',
        phone: '',
        address: ''
    });

    const handleSave = async () => {
        if (!formData.name.trim() || !user) return;
        setSaving(true);
        const res = await createCustomerAction(user.uid, formData);
        if (res.success) {
            router.push(`/customers/${res.customerId}`);
        } else {
            alert('Kunde inte skapa kund: ' + res.error);
            setSaving(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-6">
                <div>
                    <Link href="/customers" className="flex items-center text-muted-foreground hover:text-white transition-colors mb-2 text-sm">
                        <ArrowLeft size={16} className="mr-1" />
                        Tillbaka till listan
                    </Link>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Ny Kund</h1>
                    <p className="text-muted-foreground">Lägg till en ny kund i registret.</p>
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving || !formData.name}
                    className="btn-primary flex items-center gap-2"
                >
                    <Save size={16} />
                    {saving ? 'Skapar...' : 'Skapa Kund'}
                </button>
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
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Namn *</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full bg-zinc-900/50 border border-border rounded-lg px-4 py-2 text-foreground focus:ring-1 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all"
                                placeholder="Kundens namn"
                                autoFocus
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
        </div>
    );
}
