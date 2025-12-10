'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { createCustomerAction } from '@/app/actions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, User, Building, Phone, Mail, MapPin, Hash, Check } from 'lucide-react';

export default function CreateCustomerPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        type: 'private' as 'private' | 'company',
        orgNumber: '',
        phone: '',
        email: '',
        address: '',
        notes: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (!formData.name) {
            setError('Namn är obligatoriskt.');
            return;
        }

        setSubmitting(true);
        setError('');

        const res = await createCustomerAction(user.uid, formData);

        if (res.success) {
            // Redirect to the new customer's detail page or list
            router.push('/customers');
        } else {
            setError(res.error || 'Något gick fel.');
            setSubmitting(false);
        }
    };

    return (
        <div className="p-8 max-w-3xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <Link href="/customers" className="flex items-center text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft size={20} className="mr-2" />
                    Tillbaka till registret
                </Link>
            </div>

            <div className="space-y-2">
                <h1 className="text-3xl font-bold text-white">Lägg till ny Kund</h1>
                <p className="text-slate-400">
                    Fyll i kundens uppgifter noggrant för att aktivera AI-funktioner som automatisk avtalshantering.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 overflow-hidden">
                <div className="p-8 space-y-6">
                    {/* Error Msg */}
                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2 animate-in slide-in-from-top-2">
                            <span className="font-bold">Fel:</span> {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Name */}
                        <div className="space-y-2 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-300">Namn *</label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 text-slate-500" size={18} />
                                <input
                                    type="text"
                                    className="input-field w-full pl-10 p-3 bg-slate-950 border border-slate-800 rounded-lg text-white focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    placeholder="Förnamn Efternamn / Företagsnamn"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Type Toggle */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-300">Kundtyp</label>
                            <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'private' })}
                                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${formData.type === 'private' ? 'bg-slate-800 shadow text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                                    <User size={16} /> Privat
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'company' })}
                                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 ${formData.type === 'company' ? 'bg-slate-800 shadow text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                                    <Building size={16} /> Företag
                                </button>
                            </div>
                        </div>

                        {/* Org/Pers Nr */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-300">
                                {formData.type === 'company' ? 'Organisationsnummer' : 'Personnummer'}
                            </label>
                            <div className="relative">
                                <Hash className="absolute left-3 top-3 text-slate-500" size={18} />
                                <input
                                    type="text"
                                    className="input-field w-full pl-10 p-3 bg-slate-950 border border-slate-800 rounded-lg text-white focus:bg-slate-900 outline-none transition-all"
                                    placeholder={formData.type === 'company' ? '556XXX-XXXX' : 'ÅÅMMDD-XXXX'}
                                    value={formData.orgNumber}
                                    onChange={e => setFormData({ ...formData, orgNumber: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Contact Info */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-300">Telefon</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-3 text-slate-500" size={18} />
                                <input
                                    type="text"
                                    className="input-field w-full pl-10 p-3 bg-slate-950 border border-slate-800 rounded-lg text-white focus:bg-slate-900 outline-none transition-all"
                                    placeholder="070-123 45 67"
                                    value={formData.phone}
                                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-300">E-post</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 text-slate-500" size={18} />
                                <input
                                    type="email"
                                    className="input-field w-full pl-10 p-3 bg-slate-950 border border-slate-800 rounded-lg text-white focus:bg-slate-900 outline-none transition-all"
                                    placeholder="namn@exempel.se"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Address */}
                        <div className="space-y-2 md:col-span-2">
                            <label className="block text-sm font-medium text-slate-300">Adress (Gata, Postnr, Ort)</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-3 text-slate-500" size={18} />
                                <textarea
                                    className="input-field w-full pl-10 p-3 bg-slate-950 border border-slate-800 rounded-lg text-white focus:bg-slate-900 outline-none transition-all min-h-[100px]"
                                    placeholder="Storgatan 1&#10;123 45 Staden"
                                    value={formData.address}
                                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-800 flex justify-end gap-3">
                        <Link
                            href="/customers"
                            className="px-6 py-3 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                            Avbryt
                        </Link>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="bg-slate-900 text-white px-8 py-3 rounded-lg shadow-lg hover:bg-slate-800 disabled:opacity-70 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium"
                        >
                            {submitting ? 'Skapar...' : <><Check size={18} /> Skapa Kund</>}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
