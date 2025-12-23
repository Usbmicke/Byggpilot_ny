'use client';

import { useState } from 'react';
import { Loader2, FileText, CheckCircle, Lock, ExternalLink, X, Rocket, ChevronRight, AlertTriangle, ShieldCheck } from 'lucide-react';
import { prepareDraftAction, finalizeInvoiceAction } from '@/app/actions/invoice.actions';
import { useAuth } from '@/components/AuthProvider';
import { createPortal } from 'react-dom';
import { useEffect } from 'react';

function ModalOverlay({ children, onClose }: { children: React.ReactNode, onClose: () => void }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        // Prevent background scrolling
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, []);

    if (!mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 pb-32">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={onClose} />

            {/* Modal Content */}
            <div className="relative bg-white dark:bg-zinc-950 w-full max-w-3xl rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col md:flex-row shadow-black/50 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                {children}
            </div>
        </div>,
        document.body
    );
}

function PrimaryButton({ onClick, disabled, loading, children, className, variant = 'primary' }: any) {
    const baseClass = "w-full py-3 px-4 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
        primary: "bg-zinc-900 hover:bg-black text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 shadow-md",
        secondary: "bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-200",
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled || loading}
            className={`${baseClass} ${(variants as any)[variant] || variants.primary} ${className}`}
        >
            {loading ? <Loader2 className="animate-spin" size={18} /> : children}
        </button>
    );
}

export function FinalInvoiceModal({ isOpen, onClose, projectId, projectTitle, customerEmail }: { isOpen: boolean, onClose: () => void, projectId: string, projectTitle: string, customerEmail?: string }) {
    const { getToken } = useAuth();

    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
    const [loading, setLoading] = useState(false);
    const [draftLink, setDraftLink] = useState("");
    const [draftId, setDraftId] = useState("");
    const [error, setError] = useState<string | null>(null);

    // Checklist State
    const [checks, setChecks] = useState({
        agreedScope: false,
        atasApproved: false,
        pricesCorrect: false,
        qualityLog: false
    });

    // Finalize State
    const [emailSubject, setEmailSubject] = useState(`Slutfaktura - ${projectTitle}`);
    const [emailBody, setEmailBody] = useState(`Hej,\n\nHär kommer slutfakturan för projektet ${projectTitle}.\n\nTack för ett gott samarbete!\n\nMvh,\nByggPilot`);

    if (!isOpen) return null;

    const handleCreateDraft = async () => {
        setLoading(true);
        setError(null);
        const accessToken = await getToken();
        const res = await prepareDraftAction(projectId, accessToken || "");
        setLoading(false);
        if (res.success) {
            setDraftLink(res.link);
            setDraftId(res.id);
            setStep(2);
        } else {
            setError(res.message);
        }
    };

    const handleFinalize = async () => {
        setLoading(true);
        setError(null);
        const accessToken = await getToken();
        const res = await finalizeInvoiceAction({
            projectId,
            draftDocId: draftId,
            customerEmail: customerEmail || "test@example.com",
            emailSubject,
            emailBody,
            confirmLock: true
        }, accessToken || "");

        setLoading(false);
        if (res.success) {
            setStep(4);
        } else {
            setError(res.message);
        }
    };

    const isChecklistComplete = Object.values(checks).every(Boolean);

    const renderStepIndicator = (num: number, title: string, current: number) => {
        const isDone = current > num;
        const isActive = current === num;

        return (
            <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${isActive ? 'bg-zinc-100 border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700' : 'border-transparent'}`}>
                <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-sm 
                    ${isDone ? 'bg-zinc-800 text-white' : isActive ? 'bg-zinc-900 text-white dark:bg-white dark:text-black' : 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800'}`}>
                    {isDone ? <CheckCircle size={16} /> : num}
                </div>
                <span className={`font-medium ${isActive ? 'text-zinc-900 dark:text-white' : isDone ? 'text-zinc-700 dark:text-zinc-400' : 'text-zinc-400'}`}>
                    {title}
                </span>
                {isActive && <ChevronRight className="ml-auto text-zinc-500" size={16} />}
            </div>
        );
    };

    return (
        <ModalOverlay onClose={onClose}>
            {/* LEFT: PROGRESS SIDEBAR */}
            <div className="w-full md:w-80 bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-100 dark:border-zinc-800 p-5 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 bg-zinc-900 text-white rounded-lg flex items-center justify-center shadow-lg">
                            <Rocket size={16} />
                        </div>
                        <span className="font-bold text-zinc-900 dark:text-white">Fakturera</span>
                    </div>
                    <button onClick={onClose} className="md:hidden text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2 pl-1">FAKTURAFLÖDE</h3>
                <div className="space-y-2">
                    {renderStepIndicator(1, "Skapa Utkast", step)}
                    {renderStepIndicator(2, "Granska & Kontroll", step)}
                    {renderStepIndicator(3, "Lås & Skicka", step)}
                    {renderStepIndicator(4, "Klart!", step)}
                </div>

                <div className="mt-auto pt-6">
                    <p className="text-xs text-zinc-400 uppercase tracking-wider">Projekt</p>
                    <p className="font-medium text-sm text-zinc-700 dark:text-zinc-300 truncate">{projectTitle}</p>
                </div>
            </div>

            {/* RIGHT: CONTENT AREA */}
            <div className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-900 min-h-[500px]">

                {/* Mobile Header (only visible on small screens when sidebar is stacked? actually sidebar is permanent now) */}
                <div className="hidden md:flex justify-end p-4">
                    <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 p-8 pt-0 overflow-y-auto">

                    {error && (
                        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-3">
                            <AlertTriangle className="shrink-0 mt-0.5" size={18} />
                            <div className="text-sm">
                                <p className="font-bold">Ett fel uppstod</p>
                                <p>{error}</p>
                            </div>
                        </div>
                    )}

                    {/* STEP 1: CREATE DRAFT */}
                    {step === 1 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300 max-w-lg mx-auto py-4">
                            <div>
                                <h3 className="text-2xl font-bold mb-3 text-zinc-900 dark:text-white">Dags att samla ihop allt</h3>
                                <p className="text-zinc-500 text-sm leading-relaxed">
                                    Vi samlar automatiskt in all data från godkända offerter, ÄTA-arbeten och registrerade utlägg. Det skapas ett <strong>Google Doc-utkast</strong> där du kan göra ändringar.
                                </p>
                                <p className="text-zinc-500 text-sm leading-relaxed mt-2">
                                    När du är nöjd omvandlas utkastet till en proffsig PDF innan det skickas till kunden.
                                </p>
                            </div>

                            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-5 rounded-xl border border-zinc-100 dark:border-zinc-800 flex gap-3">
                                <ShieldCheck className="text-zinc-700 dark:text-zinc-300 shrink-0" size={20} />
                                <div className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                    <strong>Full Kontroll:</strong> Dokumentet öppnas i en ny flik så du får tillgång till hela Google Docs verktygslåda. Alla ändringar <strong>sparas automatiskt</strong>. Du kan stänga ner rutan när du är färdig och återkomma hit så fortsätter vi.
                                </div>
                            </div>

                            <PrimaryButton onClick={handleCreateDraft} loading={loading}>
                                <FileText size={18} /> Skapa Utkast Nu
                            </PrimaryButton>
                        </div>
                    )}

                    {/* STEP 2: CHECKLIST */}
                    {step === 2 && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300 max-w-lg mx-auto py-4">
                            <div>
                                <h3 className="text-xl font-bold mb-2 text-zinc-900 dark:text-white">Granska & Godkänn</h3>
                                <p className="text-zinc-500 text-sm">
                                    Kontrollera utkastet och bocka av säkerhetslistan för att garantera kvaliteten.
                                </p>
                            </div>

                            <a href={draftLink} target="_blank" rel="noopener noreferrer"
                                className="block w-full py-4 px-4 bg-white border-2 border-dashed border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50 rounded-xl text-center group transition-all">
                                <div className="flex flex-col items-center gap-2">
                                    <FileText size={28} className="text-zinc-400 group-hover:text-zinc-700 transition-colors" />
                                    <div>
                                        <p className="font-semibold text-zinc-700 group-hover:text-zinc-900">Öppna Utkastet i Google Docs</p>
                                        <p className="text-xs text-zinc-400">Öppnas i ny flik. Sparas automatiskt.</p>
                                    </div>
                                </div>
                            </a>

                            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-lg p-4 space-y-4">
                                <div className="flex gap-2 text-amber-800 dark:text-amber-400 font-semibold text-sm items-center">
                                    <AlertTriangle size={16} /> Säkerhetskontroll
                                </div>
                                <div className="space-y-3">
                                    {[
                                        { k: 'agreedScope', l: 'Arbetet utfört enligt avtal?' },
                                        { k: 'atasApproved', l: 'Alla ÄTA är godkända?' },
                                        { k: 'pricesCorrect', l: 'Priser & timmar stämmer?' },
                                        { k: 'qualityLog', l: 'Egenkontroller är klara?' }
                                    ].map((item) => (
                                        <label key={item.k} className="flex items-center gap-3 p-2 hover:bg-amber-100/50 dark:hover:bg-amber-900/20 rounded cursor-pointer transition-colors">
                                            <input type="checkbox" className="h-5 w-5 accent-zinc-800 rounded border-zinc-300"
                                                checked={(checks as any)[item.k]}
                                                onChange={e => setChecks({ ...checks, [item.k]: e.target.checked })} />
                                            <span className="text-zinc-700 dark:text-zinc-200 text-sm font-medium">{item.l}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button onClick={() => setStep(1)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-600 font-medium">
                                    &larr; Tillbaka
                                </button>
                                <PrimaryButton
                                    onClick={() => setStep(3)}
                                    disabled={!isChecklistComplete}
                                    variant={isChecklistComplete ? 'primary' : 'secondary'}
                                    className="flex-1"
                                >
                                    Allt ser bra ut, gå vidare &rarr;
                                </PrimaryButton>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: FINALIZE */}
                    {step === 3 && (
                        <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300 max-w-lg mx-auto py-4">
                            <div>
                                <h3 className="text-xl font-bold mb-2 text-zinc-900 dark:text-white">Lås & Skicka</h3>
                                <p className="text-zinc-500 text-sm">
                                    Sista steget! Vi konverterar dokumentet till en låst PDF och mailar kunden.
                                </p>
                            </div>

                            <div className="space-y-4 p-4 bg-zinc-50 dark:bg-zinc-800/30 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-zinc-400 uppercase">Mottagare</label>
                                    <input className="w-full p-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm text-zinc-600" defaultValue={customerEmail} disabled />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-zinc-500 uppercase">Ämne</label>
                                    <input className="w-full p-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-zinc-500 outline-none transition-all" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-zinc-500 uppercase">Meddelande</label>
                                    <textarea className="w-full p-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 h-24 resize-none text-sm focus:ring-2 focus:ring-zinc-500 outline-none transition-all" value={emailBody} onChange={e => setEmailBody(e.target.value)} />
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button onClick={() => setStep(2)} className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-600 font-medium">
                                    &larr; Tillbaka
                                </button>
                                <PrimaryButton onClick={handleFinalize} loading={loading} className="flex-1">
                                    <Lock size={18} /> Lås PDF & Skicka
                                </PrimaryButton>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: SUCCESS */}
                    {step === 4 && (
                        <div className="text-center py-10 space-y-6 animate-in zoom-in duration-500 max-w-lg mx-auto">
                            <div className="relative mx-auto w-24 h-24">
                                <div className="absolute inset-0 bg-zinc-200 dark:bg-zinc-800/30 rounded-full animate-ping opacity-20"></div>
                                <div className="h-24 w-24 bg-zinc-900 text-white rounded-full flex items-center justify-center relative z-10 shadow-xl">
                                    <Rocket size={48} />
                                </div>
                            </div>

                            <div>
                                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white mb-2">Fakturan är iväg!</h3>
                                <p className="text-zinc-500 max-w-xs mx-auto">
                                    Bra jobbat! Projektet är nu markerat som slutfört och fakturan har mailats till kunden.
                                </p>
                            </div>

                            <button onClick={onClose} className="text-sm font-medium text-zinc-400 hover:text-zinc-600 underline decoration-dotted transition-colors">
                                Stäng fönstret
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </ModalOverlay>
    );
}
