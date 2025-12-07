'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { generateOfferAction, saveOfferAction } from '@/app/actions';
import { PDFDownloadLink } from '@react-pdf/renderer'; // Import directly, Next.js 15/16 handles this better now
import OfferDocument from '@/components/pdf/OfferDocument';
import { ArrowLeft, Wand2, Save, FileText } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CreateOfferPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [step, setStep] = useState(1); // 1: Input, 2: Edit/Preview
    const [loading, setLoading] = useState(false);

    // Input State
    const [inputs, setInputs] = useState({
        projectTitle: '',
        notes: ''
    });

    // Generated Offer State
    const [offerData, setOfferData] = useState<any>(null);

    const handleGenerate = async () => {
        setLoading(true);
        const res = await generateOfferAction(inputs.projectTitle, inputs.notes);
        if (res.success) {
            setOfferData(res.data);
            setStep(2);
        } else {
            alert('AI Error: ' + res.error);
        }
        setLoading(false);
    };

    const handleSave = async () => {
        if (!user) return;
        setLoading(true);
        const res = await saveOfferAction({
            ownerId: user.uid,
            ...offerData,
            // Calculate totals locally for safety or rely on backend
            // For now pass as is, backend recalculates items
        });
        setLoading(false);
        if (res.success) {
            alert('Offert sparad!');
            router.push('/dashboard'); // Or offers list
        } else {
            alert('Save Error: ' + res.error);
        }
    };

    if (step === 1) {
        return (
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                        <ArrowLeft size={24} />
                    </Link>
                    <h1 className="text-2xl font-bold text-foreground">Skapa Offert med AI</h1>
                </div>

                <div className="bg-card p-6 rounded-xl border border-border shadow-sm space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Projektnamn / Rubrik</label>
                        <input
                            className="input-field"
                            value={inputs.projectTitle}
                            onChange={e => setInputs({ ...inputs, projectTitle: e.target.value })}
                            placeholder="t.ex. Bygga trall hos Andersson"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Anteckningar (Stolpar)</label>
                        <textarea
                            className="input-field h-40 resize-none"
                            value={inputs.notes}
                            onChange={e => setInputs({ ...inputs, notes: e.target.value })}
                            placeholder="Beskriv jobbet... Material: 200m trall, Arbete: 2 gubbar 3 dagar, bortforsling ingår ej."
                        />
                        <p className="text-xs text-muted-foreground mt-2">AI:n kommer att strukturera detta till en proffsig offert.</p>
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={loading || !inputs.notes}
                        className="w-full flex items-center justify-center gap-2 btn-primary disabled:opacity-50 transition-all"
                    >
                        {loading ? 'Genererar...' : <><Wand2 size={20} /> Generera Förslag med AI</>}
                    </button>
                </div>
            </div>
        );
    }

    // Step 2: Edit & Preview
    return (
        <div className="max-w-5xl mx-auto h-[calc(100vh-100px)] flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <button onClick={() => setStep(1)} className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                    <ArrowLeft size={16} /> Tillbaka
                </button>
                <div className="flex gap-2">
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="flex items-center gap-2 bg-card border border-border text-foreground px-4 py-2 rounded-lg hover:bg-background/50 transition-colors"
                    >
                        <Save size={18} /> Spara Utkast
                    </button>

                    {/* PDF Download Button */}
                    <PDFDownloadLink
                        document={<OfferDocument data={{
                            ...offerData,
                            totalAmount: offerData.items.reduce((s: number, i: any) => s + (i.quantity * i.unitPrice), 0),
                            vatAmount: offerData.items.reduce((s: number, i: any) => s + (i.quantity * i.unitPrice), 0) * 0.25
                        }} />}
                        fileName={`Offert-${inputs.projectTitle.replace(/\s+/g, '-')}.pdf`}
                        className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
                    >
                        {({ loading }) => (loading ? 'Bygger PDF...' : <><FileText size={18} /> Ladda ner PDF</>)}
                    </PDFDownloadLink>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-hidden">
                {/* Editor Column */}
                <div className="bg-card p-6 rounded-xl border border-border shadow-sm overflow-y-auto">
                    <h2 className="text-lg font-semibold mb-4 text-foreground">Redigera Innehåll</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-muted-foreground uppercase">Rubrik</label>
                            <input
                                className="block w-full bg-transparent border-b border-border focus:border-primary outline-none py-1 font-medium text-foreground"
                                value={offerData.title}
                                onChange={e => setOfferData({ ...offerData, title: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-muted-foreground uppercase">Introtext</label>
                            <textarea
                                className="input-field h-24"
                                value={offerData.introText}
                                onChange={e => setOfferData({ ...offerData, introText: e.target.value })}
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Artiklar</label>
                            <div className="space-y-2">
                                {offerData.items.map((item: any, idx: number) => (
                                    <div key={idx} className="flex gap-2 items-start bg-background/50 p-2 rounded border border-border">
                                        <div className="flex-1">
                                            <input
                                                className="w-full bg-transparent border-none text-sm font-medium text-foreground focus:outline-none"
                                                value={item.description}
                                                onChange={e => {
                                                    const newItems = [...offerData.items];
                                                    newItems[idx].description = e.target.value;
                                                    setOfferData({ ...offerData, items: newItems });
                                                }}
                                            />
                                        </div>
                                        <div className="w-16">
                                            <input
                                                type="number"
                                                className="w-full bg-card border border-border rounded text-sm px-1 text-foreground"
                                                value={item.quantity}
                                                onChange={e => {
                                                    const newItems = [...offerData.items];
                                                    newItems[idx].quantity = parseFloat(e.target.value);
                                                    setOfferData({ ...offerData, items: newItems });
                                                }}
                                            />
                                        </div>
                                        <div className="w-12">
                                            <input
                                                className="w-full bg-transparent border-none text-xs text-muted-foreground focus:outline-none"
                                                value={item.unit}
                                                onChange={e => {
                                                    const newItems = [...offerData.items];
                                                    newItems[idx].unit = e.target.value;
                                                    setOfferData({ ...offerData, items: newItems });
                                                }}
                                            />
                                        </div>
                                        <div className="w-20 text-right">
                                            <input
                                                type="number"
                                                className="w-full bg-card border border-border rounded text-sm px-1 text-right text-foreground"
                                                value={item.unitPrice}
                                                onChange={e => {
                                                    const newItems = [...offerData.items];
                                                    newItems[idx].unitPrice = parseFloat(e.target.value);
                                                    setOfferData({ ...offerData, items: newItems });
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-muted-foreground uppercase">Avslutningstext</label>
                            <textarea
                                className="input-field h-20"
                                value={offerData.closingText}
                                onChange={e => setOfferData({ ...offerData, closingText: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                {/* Preview Column (Simple HTML preview, PDF is generated on download) */}
                <div className="bg-background/90 p-6 rounded-xl border border-border shadow-sm overflow-y-auto flex items-center justify-center">
                    <div className="bg-white text-gray-900 shadow-2xl w-full max-w-[210mm] min-h-[297mm] p-8 text-[12px] relative transform scale-90 origin-top">
                        {/* HTML Preview mirroring the PDF layout */}
                        <div className="flex justify-between border-b pb-4 mb-8">
                            <div>
                                <h1 className="text-xl font-bold text-indigo-600">ByggPilot</h1>
                                <p className="text-gray-500">Din digitala partner</p>
                            </div>
                            <div className="text-right text-gray-500">
                                <p>OFFERT</p>
                                <p>{new Date().toLocaleDateString('sv-SE')}</p>
                            </div>
                        </div>

                        <h2 className="text-2xl font-bold text-center mb-8">{offerData.title}</h2>

                        <p className="mb-8 whitespace-pre-wrap">{offerData.introText}</p>

                        <table className="w-full mb-8">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-left p-2">Beskrivning</th>
                                    <th className="text-right p-2">Antal</th>
                                    <th className="text-right p-2">Pris</th>
                                    <th className="text-right p-2">Totalt</th>
                                </tr>
                            </thead>
                            <tbody>
                                {offerData.items.map((item: any, i: number) => (
                                    <tr key={i} className="border-b border-gray-100">
                                        <td className="p-2">{item.description}</td>
                                        <td className="text-right p-2">{item.quantity} {item.unit}</td>
                                        <td className="text-right p-2">{item.unitPrice} kr</td>
                                        <td className="text-right p-2">{(item.quantity * item.unitPrice).toFixed(0)} kr</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="flex flex-col items-end mb-8 space-y-1">
                            <div className="flex justify-between w-48">
                                <span>Att betala:</span>
                                <span>{offerData.items.reduce((s: number, i: any) => s + (i.quantity * i.unitPrice), 0)} kr</span>
                            </div>
                            <div className="flex justify-between w-48">
                                <span>Moms (25%):</span>
                                <span>{(offerData.items.reduce((s: number, i: any) => s + (i.quantity * i.unitPrice), 0) * 0.25).toFixed(0)} kr</span>
                            </div>
                            <div className="flex justify-between w-48 font-bold border-t border-black pt-2 mt-2">
                                <span>Totalt:</span>
                                <span>{(offerData.items.reduce((s: number, i: any) => s + (i.quantity * i.unitPrice), 0) * 1.25).toFixed(0)} kr</span>
                            </div>
                        </div>

                        <p className="text-gray-600 mb-8 whitespace-pre-wrap">{offerData.closingText}</p>

                        <div className="absolute bottom-8 left-0 right-0 text-center text-gray-400 text-xs border-t pt-4 mx-8">
                            Detta dokument är genererat av ByggPilot.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
