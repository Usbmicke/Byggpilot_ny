'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getCompanyProfileAction, saveCompanyProfileAction } from '@/app/actions';
import { Save, Building, Brain, Settings } from 'lucide-react';

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
        if (res.success) {
            setMsg('✅ Sparat! AI:n är nu uppdaterad.');
            setTimeout(() => setMsg(''), 3000);
        }
        else setMsg('❌ Fel vid sparning: ' + res.error);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight">Inställningar</h1>
                    <p className="text-muted-foreground mt-1">Konfigurera din företagsprofil och träna din AI-assistent.</p>
                </div>

                <div className="flex gap-2 items-center">
                    {msg && <div className="text-emerald-500 text-sm font-medium animate-in fade-in">{msg}</div>}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="btn-primary flex items-center gap-2">
                        <Save size={16} />
                        {saving ? 'Sparar...' : 'Spara Inställningar'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* Left: Hard Data */}
                <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-6">
                    <h2 className="text-xl font-semibold flex items-center gap-2 text-foreground">
                        <Building className="text-zinc-500" size={20} />
                        Företagsuppgifter
                    </h2>
                    <p className="text-xs text-muted-foreground -mt-4 pb-2 border-b border-border">Visas på offerter och dokument.</p>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Företagsnamn</label>
                            <input type="text"
                                className="w-full bg-zinc-900/50 border border-border rounded-lg px-4 py-2 text-foreground focus:ring-1 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all"
                                value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })}
                                placeholder="AB Bygg & Kakel" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Org.nummer</label>
                            <input type="text"
                                className="w-full bg-zinc-900/50 border border-border rounded-lg px-4 py-2 text-foreground focus:ring-1 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all"
                                value={profile.orgNumber} onChange={e => setProfile({ ...profile, orgNumber: e.target.value })}
                                placeholder="556XXX-XXXX" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Adress (Gata, Postnr, Ort)</label>
                            <textarea
                                className="w-full bg-zinc-900/50 border border-border rounded-lg px-4 py-2 text-foreground focus:ring-1 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all min-h-[80px] resize-none"
                                value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })}
                                placeholder="Byggvägen 1&#10;123 45 Byggstad" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">E-post</label>
                                <input type="email"
                                    className="w-full bg-zinc-900/50 border border-border rounded-lg px-4 py-2 text-foreground focus:ring-1 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all"
                                    value={profile.contactEmail} onChange={e => setProfile({ ...profile, contactEmail: e.target.value })} />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">Telefon</label>
                                <input type="text"
                                    className="w-full bg-zinc-900/50 border border-border rounded-lg px-4 py-2 text-foreground focus:ring-1 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all"
                                    value={profile.contactPhone} onChange={e => setProfile({ ...profile, contactPhone: e.target.value })} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Soft Data (AI Context) */}
                <div className="bg-card p-6 rounded-xl border border-zinc-700/50 shadow-sm space-y-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                        <Brain size={100} className="text-primary" />
                    </div>

                    <h2 className="text-xl font-semibold flex items-center gap-2 text-foreground relative z-10">
                        <Brain className="text-primary" size={20} />
                        AI-Kontext (Hjärnan)
                    </h2>
                    <p className="text-xs text-muted-foreground -mt-4 pb-2 border-b border-border relative z-10">Informationen gör dina chatt-svar och offerter smartare.</p>

                    <div className="space-y-4 relative z-10">
                        <div>
                            <label className="text-xs font-medium text-primary uppercase tracking-wider mb-1.5 block">Preferenser & Arbetssätt</label>
                            <textarea
                                className="w-full bg-zinc-900/50 border border-border rounded-lg px-4 py-3 text-zinc-300 focus:ring-1 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all min-h-[140px] text-sm leading-relaxed"
                                value={context.preferences} onChange={e => setContext({ ...context, preferences: e.target.value })}
                                placeholder="T.ex: Vi använder alltid Beckers färg. Vi föredrar att hyra ställning från Ramirent. Vi jobbar sällan helger." />
                        </div>

                        <div>
                            <label className="text-xs font-medium text-amber-500 uppercase tracking-wider mb-1.5 block">Risker & Undantag</label>
                            <textarea
                                className="w-full bg-zinc-900/50 border border-border rounded-lg px-4 py-3 text-zinc-300 focus:ring-1 focus:ring-primary/50 focus:border-primary/50 outline-none transition-all min-h-[140px] text-sm leading-relaxed"
                                value={context.risks} onChange={e => setContext({ ...context, risks: e.target.value })}
                                placeholder="T.ex: Varning för projekt med platta på mark från 70-tal. Vi undviker jobb med asbestsanering, hyr in firma för det." />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
