'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/components/AuthProvider';
import { getCompanyProfileAction, saveCompanyProfileAction } from '@/app/actions';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function SettingsPage() {
    const { user } = useAuth();
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState('');

    // Local state for form
    const [profile, setProfile] = useState({
        name: '',
        orgNumber: '',
        address: '',
        contactEmail: '',
        contactPhone: '',
        logoUrl: '',
    });

    const [context, setContext] = useState({
        preferences: '',
        risks: '',
    });

    // Load Data
    useEffect(() => {
        if (user) {
            getCompanyProfileAction(user.uid).then(res => {
                if (res.success) {
                    if (res.profile) setProfile(prev => ({ ...prev, ...res.profile }));
                    if (res.context) setContext(prev => ({ ...prev, ...res.context }));
                }
            });
        }
    }, [user]);

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        setMsg('');
        const res = await saveCompanyProfileAction(user.uid, { profile, context });
        setSaving(false);
        if (res.success) setMsg('✅ Sparat! AI:n är nu uppdaterad.');
        else setMsg('❌ Fel vid sparning: ' + res.error);
    };

    return (
        <div className="p-8 max-w-4xl mx-auto space-y-8">
            {/* Navigation */}
            <div className="flex items-center gap-4">
                <Link href="/dashboard" className="flex items-center text-slate-500 hover:text-slate-800 transition-colors">
                    <ArrowLeft size={20} className="mr-2" />
                    Tillbaka till Dashboard
                </Link>
            </div>

            <div>
                <h1 className="text-3xl font-bold text-slate-800">Inställningar & Företagsprofil</h1>
                <p className="text-slate-500">Här tränar du ByggPilot. Informationen används automatiskt i avtal och för att ge smartare råd.</p>
            </div>

            {msg && <div className="p-4 bg-green-100 text-green-800 rounded">{msg}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* Vänster: Hårda Data (Avtal) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
                    <h2 className="text-xl font-semibold mb-4">🏢 Företagsuppgifter (För Avtal/PDF)</h2>

                    <div>
                        <label className="block text-sm font-medium text-slate-700">Företagsnamn</label>
                        <input type="text" className="input-field w-full p-2 border rounded"
                            value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })}
                            placeholder="AB Bygg & Kakel" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Org.nummer</label>
                        <input type="text" className="input-field w-full p-2 border rounded"
                            value={profile.orgNumber} onChange={e => setProfile({ ...profile, orgNumber: e.target.value })}
                            placeholder="556XXX-XXXX" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700">Adress (Gata, Postnr, Ort)</label>
                        <textarea className="input-field w-full p-2 border rounded h-20"
                            value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })}
                            placeholder="Byggvägen 1&#10;123 45 Byggstad" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">E-post</label>
                            <input type="email" className="input-field w-full p-2 border rounded"
                                value={profile.contactEmail} onChange={e => setProfile({ ...profile, contactEmail: e.target.value })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Telefon</label>
                            <input type="text" className="input-field w-full p-2 border rounded"
                                value={profile.contactPhone} onChange={e => setProfile({ ...profile, contactPhone: e.target.value })} />
                        </div>
                    </div>
                </div>

                {/* Höger: Mjuka Data (AI Kontext) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4 bg-gradient-to-br from-indigo-50/50">
                    <h2 className="text-xl font-semibold mb-4 text-indigo-900">🧠 AI-Kontext (Hjärnan)</h2>

                    <div>
                        <label className="block text-sm font-medium text-indigo-900">Preferenser & Arbetssätt</label>
                        <p className="text-xs text-indigo-600 mb-1">Vad ska AI:n veta om hur ni jobbar? Vilka grossister gillar ni?</p>
                        <textarea className="input-field w-full p-2 border border-indigo-200 rounded h-32 text-sm"
                            value={context.preferences} onChange={e => setContext({ ...context, preferences: e.target.value })}
                            placeholder="T.ex: Vi använder alltid Beckers färg. Vi föredrar att hyra ställning från Ramirent. Vi jobbar sällan helger." />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-indigo-900">Risker & Erfarenheter</label>
                        <p className="text-xs text-indigo-600 mb-1">Vad ska AI:n varna för? Dåliga erfarenheter?</p>
                        <textarea className="input-field w-full p-2 border border-indigo-200 rounded h-32 text-sm"
                            value={context.risks} onChange={e => setContext({ ...context, risks: e.target.value })}
                            placeholder="T.ex: Varning för projekt med platta på mark från 70-tal. Vi undviker jobb med asbestsanering, hyr in firma för det." />
                    </div>
                </div>

            </div>

            <div className="flex justify-end pt-4">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`px-6 py-3 rounded-lg font-medium text-white shadow-md transition-colors 
            ${saving ? 'bg-slate-400' : 'bg-slate-900 hover:bg-slate-800'}`}>
                    {saving ? 'Sparar...' : 'Spara Inställningar'}
                </button>
            </div>
        </div>
    );
}
