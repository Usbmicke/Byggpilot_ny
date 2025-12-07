'use client';

import { useState } from 'react';
import { Mail, Calendar, Check, X, Bell, RefreshCw, AlertTriangle } from 'lucide-react';
import { checkInboxAction, createCalendarEventAction } from '@/app/actions';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

export default function InboxCopilot() {
    const [loading, setLoading] = useState(false);
    const [insights, setInsights] = useState<any[]>([]);
    const [scanned, setScanned] = useState(false);
    const [needsAuth, setNeedsAuth] = useState(false);

    const reconnectGoogle = async () => {
        try {
            const provider = new GoogleAuthProvider();
            provider.addScope('https://www.googleapis.com/auth/gmail.modify');
            provider.addScope('https://www.googleapis.com/auth/calendar');
            provider.setCustomParameters({ prompt: 'consent' });

            const result = await signInWithPopup(auth, provider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            if (credential?.accessToken) {
                localStorage.setItem('google_access_token', credential.accessToken);
                setNeedsAuth(false);
                handleCheckInbox(); // Retry immediately
            }
        } catch (error) {
            console.error("Re-auth failed", error);
            alert("Kunde inte ansluta till Google. Försök igen.");
        }
    };

    const handleCheckInbox = async () => {
        setLoading(true);
        setNeedsAuth(false);
        const token = localStorage.getItem('google_access_token');

        if (!token) {
            setNeedsAuth(true);
            setLoading(false);
            return;
        }

        const res = await checkInboxAction(token);

        if (res.success && res.insights) {
            setInsights(res.insights);
            setScanned(true);
        } else {
            console.error(res.error);
            if (res.error?.includes('credentials') || res.error?.includes('Token')) {
                setNeedsAuth(true);
            } else {
                alert('Ett fel uppstod vid skanning av inkorgen: ' + res.error);
            }
        }
        setLoading(false);
    };

    const handleAccept = async (item: any) => {
        const token = localStorage.getItem('google_access_token');
        if (!token) return;

        if (item.intent === 'meeting' && item.calendarData) {
            const res = await createCalendarEventAction(token, item.calendarData);
            if (res.success) {
                alert(`Möte bokat! 📅\nLänk: ${res.eventLink}`);
                setInsights(prev => prev.filter(i => i !== item));
            } else {
                alert('Fel vid bokning: ' + res.error);
            }
        } else if (item.intent === 'lead') {
            alert('Lead sparat (Simulerat) ✅');
            setInsights(prev => prev.filter(i => i !== item));
        }
    };

    const handleDismiss = (item: any) => {
        setInsights(prev => prev.filter(i => i !== item));
    };

    if (needsAuth) {
        return (
            <div className="bg-card p-6 rounded-xl border border-red-900/50 shadow-sm flex items-center justify-center">
                <div className="text-center">
                    <AlertTriangle className="mx-auto h-8 w-8 text-amber-500 mb-2" />
                    <h3 className="font-semibold text-foreground mb-1">Anslutning Krävs</h3>
                    <p className="text-sm text-muted-foreground mb-4">Google-kopplingen har löpt ut. Återanslut för att läsa mail.</p>
                    <button
                        onClick={reconnectGoogle}
                        className="bg-primary/10 text-primary px-6 py-3 rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors flex items-center gap-2 mx-auto"
                    >
                        <RefreshCw size={16} /> Återanslut Google
                    </button>
                </div>
            </div>
        );
    }

    if (!scanned && !loading) {
        return (
            <div className="bg-card p-6 rounded-xl border border-border shadow-sm flex items-center justify-center">
                <div className="text-center">
                    <h3 className="font-semibold text-foreground mb-1">Smart Inkorg</h3>
                    <p className="text-sm text-muted-foreground mb-4">Låt ByggPilot skanna efter nya jobb och möten.</p>
                    <button
                        onClick={handleCheckInbox}
                        className="bg-primary/10 text-primary px-6 py-3 rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors flex items-center gap-2 mx-auto"
                    >
                        <Mail size={16} /> Skanna Inkorg
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Bell size={18} className="text-primary" />
                    Inkorgs-insikter
                </h3>
                <button
                    onClick={() => { setScanned(false); setInsights([]); }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                >
                    Rensa
                </button>
            </div>

            {loading ? (
                <div className="space-y-3">
                    <div className="h-16 bg-background/50 rounded-lg animate-pulse"></div>
                    <div className="h-16 bg-background/50 rounded-lg animate-pulse"></div>
                </div>
            ) : insights.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                    Inget nytt av intresse just nu. Allt är lugnt! ☕
                </div>
            ) : (
                <div className="space-y-3">
                    {insights.map((item, idx) => (
                        <div key={idx} className="bg-background/50 p-4 rounded-lg border border-border flex gap-3 animate-in fade-in slide-in-from-top-2">
                            <div className="mt-1">
                                {item.intent === 'meeting' ? <Calendar className="text-primary" size={20} /> : <Mail className="text-emerald-500" size={20} />}
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-foreground">{item.summary}</p>
                                <p className="text-xs text-muted-foreground mt-1">Från: {item.original.from}</p>
                                {item.calendarData?.suggestedDate && (
                                    <div className="mt-2 text-xs bg-primary/10 text-primary p-2 rounded border border-primary/20">
                                        📅 <strong>Förslag:</strong> {new Date(item.calendarData.suggestedDate).toLocaleString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => handleAccept(item)}
                                    className="p-2 bg-card text-emerald-500 rounded-md border border-border hover:bg-emerald-500/10 shadow-sm transition-colors"
                                    title="Godkänn / Boka"
                                >
                                    <Check size={16} />
                                </button>
                                <button
                                    onClick={() => handleDismiss(item)}
                                    className="p-2 bg-card text-muted-foreground rounded-md border border-border hover:bg-red-500/10 hover:text-red-500 shadow-sm transition-colors"
                                    title="Avvisa"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
