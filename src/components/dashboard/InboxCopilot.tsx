'use client';

import { useState } from 'react';
import { Mail, Calendar, Check, X, Bell } from 'lucide-react';
import { checkInboxAction, createCalendarEventAction } from '@/app/actions';

export default function InboxCopilot() {
    const [loading, setLoading] = useState(false);
    const [insights, setInsights] = useState<any[]>([]);
    const [scanned, setScanned] = useState(false);

    const handleCheckInbox = async () => {
        setLoading(true);
        const token = localStorage.getItem('google_access_token');
        if (!token) {
            alert('Ingen Google-koppling hittad. Logga in igen.');
            setLoading(false);
            return;
        }

        const res = await checkInboxAction(token);
        if (res.success && res.insights) {
            setInsights(res.insights);
            setScanned(true);
        } else {
            console.error(res.error);
        }
        setLoading(false);
    };

    const handleAccept = async (item: any) => {
        const token = localStorage.getItem('google_access_token');
        if (!token) return;

        if (item.intent === 'meeting' && item.calendarData) {
            const res = await createCalendarEventAction(token, item.calendarData);
            if (res.success) {
                alert('Möte bokat i kalendern! 📅');
                setInsights(prev => prev.filter(i => i !== item));
            } else {
                alert('Fel vid bokning: ' + res.error);
            }
        } else if (item.intent === 'lead') {
            // Future: Create Lead in CRM
            alert('Lead sparat (Simulerat) ✅');
            setInsights(prev => prev.filter(i => i !== item));
        }
    };

    const handleDismiss = (item: any) => {
        setInsights(prev => prev.filter(i => i !== item));
    };

    if (!scanned && !loading) {
        return (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-gray-900">Smart Inkorg</h3>
                    <p className="text-sm text-gray-500">Låt ByggPilot skanna efter nya jobb och möten.</p>
                </div>
                <button
                    onClick={handleCheckInbox}
                    className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors flex items-center gap-2"
                >
                    <Mail size={16} /> Skanna Inkorg
                </button>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Bell size={18} className="text-indigo-600" />
                    Inkorgs-insikter
                </h3>
                <button
                    onClick={() => { setScanned(false); setInsights([]); }}
                    className="text-xs text-gray-400 hover:text-gray-600"
                >
                    Rensa
                </button>
            </div>

            {loading ? (
                <div className="space-y-3">
                    <div className="h-16 bg-gray-50 rounded-lg animate-pulse"></div>
                    <div className="h-16 bg-gray-50 rounded-lg animate-pulse"></div>
                </div>
            ) : insights.length === 0 ? (
                <div className="text-center py-6 text-gray-500 text-sm">
                    Inget nytt av intresse just nu. Allt är lugnt! ☕
                </div>
            ) : (
                <div className="space-y-3">
                    {insights.map((item, idx) => (
                        <div key={idx} className="bg-indigo-50/50 p-4 rounded-lg border border-indigo-100 flex gap-3 animate-in fade-in slide-in-from-top-2">
                            <div className="mt-1">
                                {item.intent === 'meeting' ? <Calendar className="text-indigo-600" size={20} /> : <Mail className="text-green-600" size={20} />}
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">{item.summary}</p>
                                <p className="text-xs text-gray-500 mt-1">Från: {item.original.from}</p>
                                {item.calendarData?.suggestedDate && (
                                    <p className="text-xs font-semibold text-indigo-700 mt-1">
                                        Förslag: {new Date(item.calendarData.suggestedDate).toLocaleString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                )}
                            </div>
                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => handleAccept(item)}
                                    className="p-2 bg-white text-green-600 rounded-md border border-gray-200 hover:bg-green-50 shadow-sm"
                                    title="Godkänn / Boka"
                                >
                                    <Check size={16} />
                                </button>
                                <button
                                    onClick={() => handleDismiss(item)}
                                    className="p-2 bg-white text-gray-400 rounded-md border border-gray-200 hover:bg-gray-100 shadow-sm"
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
