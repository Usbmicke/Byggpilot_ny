'use client';

import Link from 'next/link';
import { WeatherWidget } from '@/components/projects/WeatherWidget';
import { useEffect, useState } from 'react';
import { getItemColor } from '@/lib/utils/colors';
import { mitigateRiskAction } from '@/app/actions';
import { AlertTriangle, X, CheckSquare } from 'lucide-react';

interface RiskModalProps {
    project: any;
    risks: any[];
    onClose: () => void;
    onMitigate: (riskId: string) => void;
}

function RiskModal({ project, risks, onClose, onMitigate }: RiskModalProps) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card w-full max-w-lg rounded-xl shadow-2xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-amber-100 p-4 border-b border-amber-200 flex justify-between items-center">
                    <h3 className="text-amber-900 font-bold flex items-center gap-2">
                        <AlertTriangle size={20} className="text-amber-600" />
                        Risker Identifierade
                    </h3>
                    <button onClick={onClose} className="text-amber-800 hover:bg-amber-200 p-1 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    <p className="text-sm text-foreground">
                        ByggPilot har hittat potentiella risker i projektet <strong>{project.name}</strong> baserat på sökord.
                    </p>

                    <div className="space-y-3">
                        {risks.map((risk) => (
                            <div key={risk.id} className="flex items-start gap-3 p-3 bg-secondary/30 rounded-lg border border-border/50">
                                <AlertTriangle size={16} className="text-amber-500 mt-1 shrink-0" />
                                <div className="flex-1">
                                    <h4 className="font-semibold text-sm text-foreground">{risk.type}</h4>
                                    <p className="text-xs text-muted-foreground mt-1">{risk.description}</p>
                                </div>
                                <button
                                    onClick={() => onMitigate(risk.id)}
                                    className="px-3 py-1.5 bg-background border border-border text-xs font-medium rounded hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-colors flex items-center gap-1 whitespace-nowrap"
                                >
                                    <CheckSquare size={12} />
                                    Jag förstår
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-4 bg-secondary/20 border-t border-border flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-foreground font-medium hover:bg-background rounded-md transition-colors">
                        Stäng utan åtgärd
                    </button>
                </div>
            </div>
        </div>
    );
}

function ProjectRiskIndicator({ projectId, projectName, onOpenModal, extraRisks = [] }: { projectId: string; projectName: string; onOpenModal: (risks: any[]) => void, extraRisks?: any[] }) {
    const [risks, setRisks] = useState<any[]>([]);

    useEffect(() => {
        import('@/app/actions').then((mod: any) => {
            if (mod.getRisksAction) {
                mod.getRisksAction(projectId).then((res: any) => {
                    if (res.success && res.risks) {
                        const active = res.risks.filter((r: any) => r.status !== 'mitigated');
                        setRisks(active);
                    }
                });
            }
        });
    }, [projectId]);

    const totalRisks = [...risks, ...extraRisks];

    if (totalRisks.length === 0) return null;

    return (
        <button
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenModal(totalRisks);
            }}
            className="absolute top-0 right-0 m-0 z-20 flex items-center gap-1.5 bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1.5 rounded-bl-xl border-b border-l border-amber-200 hover:bg-amber-200 transition-all shadow-sm rounded-tr-xl"
        >
            <AlertTriangle size={14} className="fill-amber-500 text-amber-600" />
            <span>{totalRisks.length} Risk{totalRisks.length > 1 ? 'er' : ''}</span>
        </button>
    );
}

interface ProjectCardProps {
    project: any;
    variant?: 'grid' | 'horizontal';
}

export function ProjectCard({ project, variant = 'grid' }: ProjectCardProps) {
    const [isRiskModalOpen, setIsRiskModalOpen] = useState(false);
    const [activeRisks, setActiveRisks] = useState<any[]>([]);
    const [weatherRisk, setWeatherRisk] = useState<any | null>(null);

    const theme = getItemColor(project.customerName || project.name); // Color Key: Customer Name -> Project Name
    const isHorizontal = variant === 'horizontal';

    const handleMitigate = async (riskId: string) => {
        if (riskId === 'weather-risk') {
            setWeatherRisk(null);
            const remaining = activeRisks.filter(r => r.id !== riskId);
            setActiveRisks(remaining);
            if (remaining.length === 0) setIsRiskModalOpen(false);
            return;
        }
        const res = await mitigateRiskAction(riskId);
        if (res.success) {
            // Optimistic update
            const remaining = activeRisks.filter(r => r.id !== riskId);
            setActiveRisks(remaining);
            if (remaining.length === 0) setIsRiskModalOpen(false);
        }
    };

    // --- TRAFFIC LIGHT LOGIC ---
    // 1. Red: Active Risks Detected
    const hasRisks = activeRisks.length > 0 || !!weatherRisk;

    // 2. Yellow: "Waiting" states (e.g. Draft ÄTA, Pending Offer - implied by data or status)
    // For MVP, if status is 'onboarding' or 'pending', we show Yellow. 
    // Ideally we check for draft_atas count if available in project object.
    const isPending = project.status === 'onboarding' || project.status === 'pending';

    // 3. Green: Active and Risk Free
    const isGreen = !hasRisks && !isPending;

    let statusColor = "bg-emerald-500";
    let statusText = "Allt rullar";

    if (hasRisks) {
        statusColor = "bg-red-500 animate-pulse";
        statusText = "Åtgärd Krävs";
    } else if (isPending) {
        statusColor = "bg-amber-400";
        statusText = "Väntar / Utkast";
    }

    return (
        <>
            {isRiskModalOpen && (
                <RiskModal
                    project={project}
                    risks={activeRisks}
                    onClose={() => setIsRiskModalOpen(false)}
                    onMitigate={handleMitigate}
                />
            )}

            <div
                className={`relative block bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-all group hover:border-zinc-500/50 overflow-hidden ${isHorizontal ? 'flex flex-col sm:flex-row' : ''}`}
            >
                {/* Main Link Overlay */}
                <Link
                    href={`/projects/${project.id}`}
                    className="absolute inset-0 z-10 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-xl"
                    aria-label={`Öppna ${project.name}`}
                />

                {/* Risk Indicator (Functional / Logic Container) */}
                <div className="absolute top-0 right-0 z-20 pointer-events-auto">
                    <ProjectRiskIndicator
                        projectId={project.id}
                        projectName={project.name}
                        extraRisks={weatherRisk ? [weatherRisk] : []}
                        onOpenModal={(risks) => {
                            setActiveRisks(risks);
                            setIsRiskModalOpen(true);
                        }}
                    />
                </div>

                {/* Color/Icon Sidebar (Now with Traffic Light Strip) */}
                <div className={`${isHorizontal ? 'w-full sm:w-24 border-b sm:border-b-0 sm:border-r' : 'h-24 border-b'} ${theme.bg} ${theme.border} flex flex-col items-center justify-center shrink-0 relative overflow-hidden`}>

                    {/* Traffic Light Bar */}
                    <div className={`absolute top-0 left-0 w-1.5 h-full ${statusColor}`} title={`Status: ${statusText}`} />

                    <div className={`h-12 w-12 rounded-xl bg-white/70 shadow-sm flex items-center justify-center text-xl font-bold ${theme.text} z-10`}>
                        {(project.customerName || project.name).charAt(0).toUpperCase()}
                    </div>
                </div>

                {/* Content */}
                <div className={`p-4 pl-5 flex-1 flex ${isHorizontal ? 'flex-col justify-between' : 'flex-col'}`}>
                    <div>
                        <div className="flex justify-between items-start mb-1 pr-20">
                            <div>
                                <h3 className="font-semibold text-foreground text-lg group-hover:text-primary transition-colors line-clamp-1">
                                    {project.name}
                                </h3>

                                <div className="flex items-center gap-2 mt-0.5">
                                    {/* Traffic Light Dot (Visible Info) */}
                                    <div className={`w-2.5 h-2.5 rounded-full ${statusColor}`} />
                                    <span className="text-xs font-medium text-muted-foreground">{statusText}</span>

                                    {project.projectNumber && (
                                        <span className="text-[10px] font-mono opacity-50 ml-1">#{project.projectNumber}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                            {project.customerName && (
                                <Link
                                    href={project.customerId ? `/customers/${project.customerId}` : '#'}
                                    className={`relative z-20 flex items-center gap-1.5 text-xs font-medium ${theme.text} bg-white/50 px-2 py-1 rounded-md border border-black/5 hover:bg-white hover:shadow-sm transition-all`}
                                    onClick={(e) => {
                                        if (!project.customerId) e.preventDefault();
                                    }}
                                >
                                    <span className="capitalize">{project.customerName}</span>
                                    {project.customerId && <span className="text-[10px] opacity-50 group-hover/link:opacity-100">✏️</span>}
                                </Link>
                            )}
                        </div>
                    </div>

                    <div className={`flex flex-wrap gap-x-4 gap-y-2 items-end relative z-20 pointer-events-auto mt-4`}>
                        <div className="flex gap-2 items-center ml-auto">
                            <Link
                                href={`/projects/${project.id}/ata`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 px-3 py-1.5 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white rounded-lg text-xs font-semibold transition-colors border border-zinc-700 shadow-sm"
                                title="Hantera ÄTA"
                            >
                                <span>ÄTA</span>
                            </Link>

                            <div className="w-full sm:w-auto max-w-[200px]">
                                <WeatherWidget
                                    address={project.address}
                                    projectId={project.id}
                                    projectName={project.name}
                                    projectDescription={project.description}
                                    onRiskDetected={setWeatherRisk}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
