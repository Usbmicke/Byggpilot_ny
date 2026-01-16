'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
    const [hasCritical, setHasCritical] = useState(false); // New

    const [globalStatus, setGlobalStatus] = useState<any>(null);

    // Poll for inbox updates & global status
    useEffect(() => {
        if (user) {
            checkInbox();
            checkGlobalStatus();
            checkCriticalStops(); // New
            // Polling
            const interval = setInterval(() => {
                checkInbox();
                checkGlobalStatus();
                checkCriticalStops(); // New
            }, 60 * 1000);
            return () => clearInterval(interval);
        }
    }, [user]);

    const checkCriticalStops = () => {
        import('@/app/actions').then(async ({ getCriticalStopsAction }) => {
            if (getCriticalStopsAction) {
                const res = await getCriticalStopsAction();
                if (res.success && res.items && res.items.length > 0) {
                    setHasCritical(true);
                } else {
                    setHasCritical(false);
                }
            }
        });
    };

    const checkGlobalStatus = async () => {
        try {
            // Dynamically import to avoid build issues if mixed server/client env not perfect
            const { getGlobalStatusAction } = await import('@/app/actions');
            const status = await getGlobalStatusAction();
            if (status.success) {
                setGlobalStatus(status);
            }
        } catch (e) {
            console.error("Global status check failed", e);
        }
    };

    const checkInbox = async () => {
        const token = localStorage.getItem('google_access_token');
        const expiry = localStorage.getItem('google_token_expiry');
        const now = Date.now();

        if (!token || (expiry && now > parseInt(expiry))) {
            setNeedsAuth(true);
            return;
        }

        setLoading(true);
        try {
            const res = await checkInboxAction(token);
            if (res.success && res.insights) {
                setInsights(res.insights);
                setNeedsAuth(false);
            } else if (res.error?.includes('credentials') || res.error?.includes('Token')) {
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
                // 1 hour expiry (minus 5 min safety buffer)
                const expiry = Date.now() + (60 * 60 * 1000) - (5 * 60 * 1000);
                localStorage.setItem('google_token_expiry', expiry.toString());
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
    const hasGlobalWarning = globalStatus?.hasWarnings;

    return (
        <div className="relative">
            {/* Bell Icon */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative p-2 rounded-full transition-colors ${isOpen ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50 text-muted-foreground'
                    }`}
            >
                <Bell size={20} className={hasGlobalWarning ? 'text-red-500' : isAuthWarning ? 'text-amber-500' : hasNotifications ? 'text-primary' : ''} />

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

                {/* CRITICAL STOP DOT (Strategic Audit - "Avisering måste lysa") */}
                {hasCritical && !hasNotifications && !isAuthWarning && (
                    <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
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
                        {/* Global Status Warnings */}
                        {globalStatus?.hasWarnings && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm mb-2">
                                <p className="text-red-600 font-bold mb-1">⚠️ Åtgärd krävs</p>
                                <ul className="list-disc list-inside text-xs text-red-700 space-y-1">
                                    {globalStatus.profileIncomplete && <li>Företagsprofil saknar uppgifter (OrgNr/Adress)</li>}
                                    {globalStatus.incompleteCustomersCount > 0 && <li>{globalStatus.incompleteCustomersCount} kunder saknar kontaktuppgifter</li>}
                                </ul>
                                <button
                                    onClick={() => router.push('/settings')}
                                    className="mt-2 text-xs bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 w-full"
                                >
                                    Gå till inställningar
                                </button>
                            </div>
                        )}

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

                        {!isAuthWarning && !globalStatus?.hasWarnings && insights.length === 0 && (
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
    const router = useRouter();
    const [conflictWarning, setConflictWarning] = useState<string | null>(null);
    const [viewState, setViewState] = useState<'normal' | 'conflict' | 'success'>('normal');
    const [eventLink, setEventLink] = useState<string | null>(null);
    const [isBooking, setIsBooking] = useState(false);

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

    const handleBooking = async (ignoreConflict = false) => {
        // If we have a conflict and haven't ignored it yet, show conflict UI
        if (conflictWarning && !ignoreConflict) {
            setViewState('conflict');
            return;
        }

        const token = localStorage.getItem('google_access_token');
        if (!token) return;

        setIsBooking(true);
        const res = await createCalendarEventAction(token, item.calendarData);
        setIsBooking(false);

        if (res.success) {
            setEventLink(res.eventLink || null);
            setViewState('success');
        } else {
            alert('Fel: ' + res.error); // Fallback for actual errors
        }
    };

    const handleDraftEmail = () => {
        // Construct prompt with thread context
        let prompt = `Jag har bokat möte med ${item.original.from} den ${item.calendarData.suggestedDate}. Skriv ett trevligt bekräftelsemail.`;

        // Add Thread ID context if available
        if (item.original?.threadId) {
            prompt += ` Svara på mailet som hör till tråd ID: ${item.original.threadId}.`;
        } else {
            prompt += ` (Starta en ny tråd då tråd-ID saknas).`;
        }

        // Navigate without reload
        const params = new URLSearchParams();
        params.set('chatQuery', prompt);
        router.push(`?${params.toString()}`);

        // Close notification
        onDismiss();
    };

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
                // SUCCESS - Ask flow
                const askEmail = confirm(`Möte bokat! ✅\n\nVill du förbereda ett bekräftelsemail till ${item.original.from}?`);
                if (askEmail) {
                    // Redirect to chat with query
                    const prompt = `Jag har bokat möte med ${item.original.from} den ${item.calendarData.suggestedDate}. Föreslå ett utkast till bekräftelsemail (Skicka inte än).`;
                    // Use window.location or router? NotificationBell uses useRouter?
                    // We need to import useRouter.
                    // Since we are in a client component, we can use window.location.href to be safe or useRouter.
                    // Let's use router.
                    window.location.href = `?chatQuery=${encodeURIComponent(prompt)}`;
                } else {
                    alert(`Möte bokat via snabbval! 📅\n${res.eventLink}`);
                }
                onDismiss();
            } else {
                alert('Fel: ' + res.error);
            }
        } else if (item.intent === 'lead') {
            // LEAD ACTION: Propose Project Creation
            const prompt = `Jag har hittat en jobbförfrågan från ${item.original.from}: '${item.summary}'. Ska jag starta ett nytt projekt? (Analysera mailet för detaljer om adress osv).`;

            // Navigate to Chat
            // Note: In Next.js client component, pushing with query param is tricky if layout doesn't re-render chat.
            // But ChatInterface listens to useSearchParams, so pushing to current path + query should work.
            if (window.location.search) {
                const current = new URLSearchParams(window.location.search);
                current.set('chatQuery', prompt);
                window.history.pushState(null, '', `?${current.toString()}`);
            } else {
                window.history.pushState(null, '', `?chatQuery=${encodeURIComponent(prompt)}`);
            }
            // Force a small delay or event to notify Chat? 
            // The ChatInterface poll interval or useEffect on searchParams should pick it up. 
            // Better: user router.push logic as before, just reusing the existing draft logic.
            window.location.href = `?chatQuery=${encodeURIComponent(prompt)}`;

            onDismiss();
        }
    };

    const handleOpenEmail = () => {
        if (item.original?.id) {
            window.open(`https://mail.google.com/mail/u/0/#inbox/${item.original.id}`, '_blank');
        }
    };

    // --- RENDER STATES ---

    if (viewState === 'success') {
        return (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 animate-in fade-in duration-300">
                <div className="flex items-center gap-2 mb-2">
                    <div className="bg-emerald-500 text-white rounded-full p-1">
                        <Check size={12} strokeWidth={3} />
                    </div>
                    <p className="font-semibold text-sm text-emerald-700 dark:text-emerald-400">Möte bokat!</p>
                </div>
                <p className="text-xs text-muted-foreground mb-3">Vill du skicka en bekräftelse till {item.original.from}?</p>

                <div className="grid grid-cols-2 gap-2">
                    <button onClick={handleDraftEmail} className="col-span-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 rounded-md transition-colors shadow-sm">
                        Ja, förbered mail
                    </button>
                    <button onClick={onDismiss} className="col-span-1 bg-background border border-border hover:bg-accent text-xs font-medium py-2 rounded-md transition-colors">
                        Nej, klar
                    </button>
                </div>
            </div>
        );
    }

    if (viewState === 'conflict') {
        return (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 animate-in slide-in-from-right-2 duration-200">
                <p className="text-xs font-bold text-red-600 dark:text-red-400 mb-1">⚠️ Dubbelbokning varnad!</p>
                <p className="text-xs text-red-800 dark:text-red-300 mb-3">{conflictWarning}</p>
                <div className="flex gap-2">
                    <button onClick={() => handleBooking(true)} className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold py-2 rounded-md shadow-sm">
                        Boka ändå
                    </button>
                    <button onClick={() => setViewState('normal')} className="flex-1 bg-background border border-border hover:bg-accent text-xs font-medium py-2 rounded-md">
                        Avbryt
                    </button>
                </div>
            </div>
        );
    }

    // NORMAL STATE
    const hasConflict = !!conflictWarning;

    return (
        <div className={`bg-background/50 border rounded-lg p-3 transition-colors ${hasConflict ? 'border-red-500/30 bg-red-500/5' : 'border-border hover:bg-accent/5'}`}>
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
                            {hasConflict && (
                                <span className="text-xs text-red-400 font-medium mt-1 block">
                                    {conflictWarning}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-border/50">
                {/* Primary Action */}
                <button
                    onClick={() => handleBooking(false)}
                    disabled={isBooking}
                    className="col-span-1 text-xs bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition-colors font-semibold shadow-sm flex items-center justify-center gap-2"
                >
                    {isBooking && <Loader2 size={12} className="animate-spin" />}
                    {item.intent === 'meeting' ? 'Boka i kalendern' : item.intent === 'lead' ? 'Starta projektförslag' : 'Hantera'}
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
