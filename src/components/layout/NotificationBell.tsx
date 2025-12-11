'use client';

import { useState, useEffect } from 'react';
import { Mail, Calendar, Bell, X, Check, Loader2 } from 'lucide-react';
import { checkInboxAction, createCalendarEventAction } from '@/app/actions';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { useAuth } from '@/components/AuthProvider';

export default function NotificationBell() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [insights, setInsights] = useState<any[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [needsAuth, setNeedsAuth] = useState(false);

    // Poll for inbox updates
    useEffect(() => {
        if (user) {
            checkInbox();
            // Optional: Poll every 5 minutes
            const interval = setInterval(checkInbox, 5 * 60 * 1000);
            return () => clearInterval(interval);
        }
    }, [user]);

    const checkInbox = async () => {
        const token = localStorage.getItem('google_access_token');
        if (!token) {
            setNeedsAuth(true); // Don't nag, just show yellow dot maybe?
            return;
        }

        setLoading(true);
        try {
            const res = await checkInboxAction(token);
            if (res.success && res.insights) {
                setInsights(res.insights);
                setNeedsAuth(false);
            } else if (res.error?.includes('credentials')) {
                setNeedsAuth(true);
            }
        } catch (e) {
            console.error("Inbox check failed", e);
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async () => {
        try {
            const provider = new GoogleAuthProvider();
            provider.addScope('https://www.googleapis.com/auth/gmail.modify');
            provider.addScope('https://www.googleapis.com/auth/calendar');
            const result = await signInWithPopup(auth, provider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            if (credential?.accessToken) {
                localStorage.setItem('google_access_token', credential.accessToken);
                setNeedsAuth(false);
                checkInbox();
            }
        } catch (error) {
            console.error(error);
        }
    };

    // Derived State
    const hasNotifications = insights.length > 0;
    const isAuthWarning = needsAuth;

    return (
        <div className="relative">
            {/* Bell Icon */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative p-2 rounded-full transition-colors ${isOpen ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50 text-muted-foreground'
                    }`}
            >
                <Bell size={20} className={isAuthWarning ? 'text-amber-500' : hasNotifications ? 'text-primary' : ''} />

                {/* Ping Animation for Notifications */}
                {hasNotifications && !isOpen && (
                    <span className="absolute top-1.5 right-1.5 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500"></span>
                    </span>
                )}

                {/* Warning Dot for Auth */}
                {isAuthWarning && !hasNotifications && (
                    <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500" />
                )}
            </button>

            {/* Dropdown / Popover */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 md:w-96 bg-card border border-border shadow-xl rounded-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-4 border-b border-border flex justify-between items-center bg-muted/30">
                        <h4 className="font-semibold text-sm">Notiser</h4>
                        <div className="flex gap-2 items-center">
                            {loading && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
                            <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="max-h-[400px] overflow-y-auto p-2 space-y-2">
                        {isAuthWarning && (
                            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">
                                <p className="text-amber-600 font-medium mb-2">Anslut Google för att se aviseringar</p>
                                <button
                                    onClick={handleLogin}
                                    className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded hover:bg-amber-600 w-full"
                                >
                                    Anslut nu
                                </button>
                            </div>
                        )}

                        {!isAuthWarning && insights.length === 0 && (
                            <div className="py-8 text-center text-muted-foreground text-sm">
                                Inga nya händelser just nu.
                            </div>
                        )}

                        {insights.map((item, i) => (
                            <NotificationItem key={i} item={item} onDismiss={() => setInsights(prev => prev.filter(x => x !== item))} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function NotificationItem({ item, onDismiss }: { item: any, onDismiss: () => void }) {
    const [conflictWarning, setConflictWarning] = useState<string | null>(null);

    // Proactive Conflict Check on Mount
    useEffect(() => {
        const check = async () => {
            if (item.intent === 'meeting' && item.calendarData?.suggestedDate) {
                const token = localStorage.getItem('google_access_token');
                if (!token) return;

                const startTime = new Date(item.calendarData.suggestedDate);
                const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

                // Dynamically import action to avoid server-client issues if not handled by framework
                const { checkAvailabilityAction } = await import('@/app/actions');
                const result = await checkAvailabilityAction(token, startTime.toISOString(), endTime.toISOString());

                if (result.success && result.hasConflict) {
                    const conflict = result.conflicts[0];
                    const startVal = conflict.start?.dateTime ?? conflict.start?.date;
                    const endVal = conflict.end?.dateTime ?? conflict.end?.date;

                    if (startVal && endVal) {
                        const startTime = new Date(startVal).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
                        const endTime = new Date(endVal).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
                        setConflictWarning(`⚠️ Annat möte inbokat: ${conflict.summary} (${startTime} - ${endTime})`);
                    } else {
                        setConflictWarning(`⚠️ Annat möte inbokat: ${conflict.summary}`);
                    }
                }
            }
        };
        check();
    }, [item]);

    const handleAction = async () => {
        const token = localStorage.getItem('google_access_token');
        if (!token) return;

        if (item.intent === 'meeting' && item.calendarData) {
            // Re-check (double safety) or just confirm if warning exists
            if (conflictWarning) {
                const proceed = confirm(`⚠️ DU HAR EN KROCK!\n${conflictWarning}\n\nVill du boka ändå?`);
                if (!proceed) return;
            }

            const res = await createCalendarEventAction(token, item.calendarData);
            if (res.success) {
                alert(`Möte bokat via snabbval! 📅\n${res.eventLink}`);
                onDismiss();
            } else {
                alert('Fel: ' + res.error);
            }
        }
    };

    const handleOpenEmail = () => {
        if (item.original?.id) {
            window.open(`https://mail.google.com/mail/u/0/#inbox/${item.original.id}`, '_blank');
        }
    };

    return (
        <div className={`bg-background/50 border rounded-lg p-3 transition-colors ${conflictWarning ? 'border-red-500/30 bg-red-500/5' : 'border-border hover:bg-accent/5'}`}>
            <div className="flex gap-3">
                <div className="mt-1 text-primary">
                    {item.intent === 'meeting' ? <Calendar size={18} /> : <Mail size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.summary}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.original.from}</p>
                    {item.calendarData?.suggestedDate && (
                        <div className="mt-1.5 flex flex-col gap-1">
                            <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded inline-block w-fit">
                                📅 {new Date(item.calendarData.suggestedDate).toLocaleDateString('sv-SE')} kl {new Date(item.calendarData.suggestedDate).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {conflictWarning && (
                                <span className="text-xs text-red-400 font-medium mt-1 block">
                                    {conflictWarning}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-border/50">
                {/* Primary Action - FORCE VIVID COLOR */}
                <button onClick={handleAction} className="col-span-1 text-xs bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors font-semibold shadow-sm">
                    {item.intent === 'meeting' ? 'Boka i kalendern' : 'Hantera'}
                </button>

                {/* Secondary Actions */}
                <div className="col-span-1 flex gap-2">
                    <button onClick={handleOpenEmail} className="flex-1 text-xs bg-secondary text-secondary-foreground border border-border rounded-md hover:bg-secondary/80 transition-colors flex items-center justify-center gap-1" title="Öppna mail">
                        <Mail size={14} />
                    </button>
                    <button onClick={onDismiss} className="flex-1 text-xs bg-background border border-border rounded-md hover:bg-red-500/10 hover:text-red-500 text-muted-foreground flex items-center justify-center gap-1" title="Avfärda">
                        <X size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
}
