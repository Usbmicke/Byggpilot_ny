import { ChangeOrderRepo } from '@/lib/dal/ata.repo';
import { ApproveButton } from '@/components/ata/ApproveButton';
import { ProjectRepo } from '@/lib/dal/project.repo';
import { UserRepo } from '@/lib/dal/user.repo';
import { CompanyRepo } from '@/lib/dal/company.repo';

export default async function ApprovePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ata = await ChangeOrderRepo.get(id);

    if (!ata) {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
                <div className="text-zinc-400">ÄTA hittades inte eller har tagits bort.</div>
            </div>
        );
    }

    // Check status
    if (ata.status === 'approved') {
        return (
            <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
                <div className="bg-zinc-900 border border-green-900/50 p-8 rounded-2xl max-w-md w-full text-center">
                    <div className="text-5xl mb-4">✅</div>
                    <h1 className="text-2xl font-bold text-white mb-2">Redan Godkänd</h1>
                    <p className="text-zinc-400">Denna ÄTA godkändes {ata.approvedAt?.toDate().toLocaleDateString()}. Jobbet är beställt.</p>
                </div>
            </div>
        );
    }

    // Fetch Context
    const project = await ProjectRepo.get(ata.projectId);
    let companyName = "Byggaren";
    if (project?.ownerId) {
        const u = await UserRepo.get(project.ownerId);
        if (u?.companyId) {
            const c = await CompanyRepo.get(u.companyId);
            if (c) companyName = c.profile?.name || c.name || companyName;
        }
    }

    const totalCost = ata.estimatedCost;
    const vat = totalCost * 0.25;
    const totalWithVat = totalCost + vat;

    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 md:p-8 font-sans">
            <div className="max-w-xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="text-sm font-medium text-amber-500 tracking-wider uppercase">Beställning av Tilläggsarbete</div>
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-2">ÄTA-Godkännande</h1>
                    <div className="text-zinc-500">Projekt: <span className="text-zinc-300">{project?.name || 'Okänt Projekt'}</span></div>
                </div>

                {/* Card */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
                    {/* Body */}
                    <div className="p-6 md:p-8 space-y-6">

                        <div>
                            <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider">Beskrivning</label>
                            <div className="text-lg md:text-xl text-zinc-100 mt-1 font-medium leading-relaxed">
                                {ata.description}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800/50">
                            <div>
                                <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider">Mängd</label>
                                <div className="text-zinc-300">{ata.quantity} {ata.unit || 'st'}</div>
                            </div>
                            <div>
                                <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider">Typ</label>
                                <div className="text-zinc-300 capitalize">{ata.type === 'work' ? 'Arbete' : ata.type === 'material' ? 'Material' : 'Övrigt'}</div>
                            </div>
                        </div>

                        {/* Price Block */}
                        <div className="bg-zinc-950 rounded-xl p-4 border border-zinc-800">
                            <div className="flex justify-between items-end">
                                <div>
                                    <label className="text-xs uppercase text-zinc-500 font-semibold tracking-wider block mb-1">Beräknad Kostnad</label>
                                    <div className="text-3xl font-bold text-white">{totalCost.toLocaleString('sv-SE')} kr</div>
                                    <div className="text-sm text-zinc-500">+ moms ({vat.toLocaleString('sv-SE')} kr)</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-zinc-500">Att betala:</div>
                                    <div className="text-lg font-medium text-zinc-300">{totalWithVat.toLocaleString('sv-SE')} kr</div>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Footer / Action */}
                    <div className="bg-zinc-900/50 p-6 md:p-8 border-t border-zinc-800">
                        <ApproveButton ataId={ata.id} />
                        <div className="mt-6 text-center text-zinc-600 text-xs">
                            Detta är en digital bekräftelse till {companyName}.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
