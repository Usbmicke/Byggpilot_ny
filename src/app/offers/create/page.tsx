'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getCustomersAction, getRecipesAction, calculateOfferAction, createOfferPdfAction } from '@/app/actions';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, ChevronRight, Calculator, FileText, AlertCircle, Loader2 } from 'lucide-react';

export default function CreateOfferPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Data Sources
    const [customers, setCustomers] = useState<any[]>([]);
    const [recipes, setRecipes] = useState<any[]>([]);

    // Selection State
    const [selectedCustomerId, setSelectedCustomerId] = useState('');
    const [selectedRecipeId, setSelectedRecipeId] = useState('');
    const [quantity, setQuantity] = useState(10); // Standard m2
    const [margin, setMargin] = useState(15); // %
    const [riskBuffer, setRiskBuffer] = useState(10); // %
    const [projectTitle, setProjectTitle] = useState('');

    // Calculation Result
    const [calcResult, setCalcResult] = useState<any>(null);

    // Final Output
    const [pdfResult, setPdfResult] = useState<any>(null);

    // Load Data
    useEffect(() => {
        if (user) {
            getCustomersAction(user.uid).then(res => res.success && setCustomers(res.customers || []));
            getRecipesAction().then(res => res.success && setRecipes(res.recipes || []));
        }
    }, [user]);

    // Handlers
    const handleCalculate = async () => {
        if (!selectedRecipeId) return;
        setLoading(true);
        const res = await calculateOfferAction({
            recipeId: selectedRecipeId,
            quantity: Number(quantity),
            margin: Number(margin) / 100,
            riskBuffer: Number(riskBuffer) / 100,
        });
        setLoading(false);
        if (res.success) {
            setCalcResult(res.data);
            setStep(3); // Go to review
        } else {
            alert('Kalkylfel: ' + res.error);
        }
    };

    const handleGeneratePdf = async () => {
        if (!user || !calcResult || !selectedCustomerId) return;
        const customer = customers.find(c => c.id === selectedCustomerId);
        if (!customer) return;

        setLoading(true);

        const pdfInput = {
            contractor: {
                name: 'Mitt Byggföretag AB', // TODO: Fetch from company profile
                orgNumber: '556677-8899',   // TODO
                address: 'Byggvägen 1, Stockholm' // TODO
            },
            customer: {
                name: customer.name,
                address: customer.address || 'Adress saknas',
            },
            project: {
                name: projectTitle || `Offert: ${recipes.find(r => r.id === selectedRecipeId)?.name}`,
                description: `Arbete enligt recept: ${recipes.find(r => r.id === selectedRecipeId)?.name}. Kvantitet: ${quantity} enheter.`
            },
            items: [
                ...calcResult.breakdown.map((txt: string) => {
                    // Quick parse of breakdown string "Mat: 10st (~100kr)" - this is hacky, ideally tool returns structured items
                    return {
                        description: txt.split(' (~')[0],
                        quantity: 1,
                        unit: 'st',
                        pricePerUnit: 0, // Hidden in breakdown string
                        total: 0 // Hidden
                    };
                }),
                {
                    description: 'Arbetskostnad (Beräknad tid)',
                    quantity: calcResult.totalHours,
                    unit: 'tim',
                    pricePerUnit: 650, // Hardcoded in tool currently
                    total: calcResult.costLabor
                },
                {
                    description: 'Materialkostnad (Estimerad)',
                    quantity: 1,
                    unit: 'kp',
                    pricePerUnit: calcResult.costMaterials,
                    total: calcResult.costMaterials
                },
                {
                    description: 'Risk- & Vinstpåslag',
                    quantity: 1,
                    unit: 'kp',
                    pricePerUnit: calcResult.netProfit,
                    total: calcResult.netProfit
                }
            ],
            totals: {
                // Tool returns total price (excl VAT base).
                subtotal: calcResult.totalPrice,
                vatAmount: Math.round(calcResult.totalPrice * 0.25),
                totalToPay: Math.round(calcResult.totalPrice * 1.25)
            },
            targetFolderId: undefined // Save in memory/root for now (MVP)
        };

        const res = await createOfferPdfAction(pdfInput);
        setLoading(false);
        if (res.success) {
            setPdfResult(res.data);
            setStep(4);
        } else {
            alert('PDF-fel: ' + res.error);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto min-h-screen">
            <div className="mb-8">
                <Link href="/offers" className="text-slate-500 hover:text-slate-800 flex items-center mb-4">
                    <ArrowLeft size={16} className="mr-2" /> Avbryt
                </Link>
                <h1 className="text-3xl font-bold text-slate-900">Skapa Ny Offert</h1>

                {/* Steps */}
                <div className="flex items-center mt-6 gap-4 text-sm font-medium">
                    <div className={`flex items-center gap-2 ${step >= 1 ? 'text-indigo-600' : 'text-slate-300'}`}>
                        <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center border-current">1</span> Val
                    </div>
                    <ChevronRight size={16} className="text-slate-300" />
                    <div className={`flex items-center gap-2 ${step >= 2 ? 'text-indigo-600' : 'text-slate-300'}`}>
                        <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center border-current">2</span> Kalibrering
                    </div>
                    <ChevronRight size={16} className="text-slate-300" />
                    <div className={`flex items-center gap-2 ${step >= 3 ? 'text-indigo-600' : 'text-slate-300'}`}>
                        <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center border-current">3</span> Granska
                    </div>
                </div>
            </div>

            {/* STEP 1: SELECT */}
            {step === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h2 className="text-xl font-semibold mb-4">1. Välj Kund</h2>
                        <select
                            className="input-field w-full p-3 bg-slate-50 border rounded-lg"
                            value={selectedCustomerId}
                            onChange={(e) => setSelectedCustomerId(e.target.value)}
                        >
                            <option value="">-- Välj kund --</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <p className="text-sm text-slate-500 mt-2">Saknas kunden? Lägg till i <Link href="/customers" className="text-indigo-600 underline">Kundregistret</Link>.</p>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h2 className="text-xl font-semibold mb-4">2. Välj Arbetsmoment (Recept)</h2>
                        <select
                            className="input-field w-full p-3 bg-slate-50 border rounded-lg"
                            value={selectedRecipeId}
                            onChange={(e) => setSelectedRecipeId(e.target.value)}
                        >
                            <option value="">-- Välj recept --</option>
                            {recipes.map(r => <option key={r.id} value={r.id}>{r.name} ({r.description})</option>)}
                        </select>
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Mängd</label>
                            <input
                                type="number"
                                className="input-field w-32 p-3 bg-slate-50 border rounded-lg"
                                value={quantity}
                                onChange={(e) => setQuantity(Number(e.target.value))}
                            />
                            <span className="ml-2 text-slate-500">enheter (t.ex. m2)</span>
                        </div>
                    </div>

                    <button
                        onClick={() => setStep(2)}
                        disabled={!selectedCustomerId || !selectedRecipeId}
                        className="btn-primary w-full py-4 text-lg bg-indigo-600 text-white rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors"
                    >
                        Gå vidare
                    </button>
                </div>
            )}

            {/* STEP 2: TUNE */}
            {step === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h2 className="text-xl font-semibold mb-4">Kalibrera Kalkyl</h2>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Vinstmarginal (%)</label>
                                <input
                                    type="number"
                                    className="input-field w-full p-3 bg-slate-50 border rounded-lg text-lg font-bold"
                                    value={margin}
                                    onChange={(e) => setMargin(Number(e.target.value))}
                                />
                                <p className="text-xs text-slate-400 mt-1">Standard: 15%</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Riskbuffert (%)</label>
                                <input
                                    type="number"
                                    className="input-field w-full p-3 bg-slate-50 border rounded-lg text-lg font-bold"
                                    value={riskBuffer}
                                    onChange={(e) => setRiskBuffer(Number(e.target.value))}
                                />
                                <p className="text-xs text-slate-400 mt-1">För oförutsedda utgifter. Standard: 10%</p>
                            </div>
                        </div>

                        <div className="mt-6">
                            <label className="block text-sm font-medium text-slate-700 mb-2">Projekttitel (till Offert)</label>
                            <input
                                type="text"
                                className="input-field w-full p-3 bg-slate-50 border rounded-lg"
                                placeholder="T.ex. Badrumsrenovering Storgatan"
                                value={projectTitle}
                                onChange={(e) => setProjectTitle(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleCalculate}
                        disabled={loading}
                        className="btn-primary w-full py-4 text-lg bg-indigo-600 text-white rounded-xl shadow-lg disabled:opacity-50 hover:bg-indigo-700 transition-colors flex justify-center items-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <><Calculator /> Beräkna Offert</>}
                    </button>
                </div>
            )}

            {/* STEP 3: REVIEW */}
            {step === 3 && calcResult && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-lg">
                        <div className="flex justify-between items-start mb-6 border-b pb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">Kalkylresultat</h2>
                                <p className="text-slate-500">Baserat på valt recept och dina parametrar.</p>
                            </div>
                            <div className="text-right">
                                <span className="block text-sm text-slate-400">Totalt att fakturera (exkl moms)</span>
                                <span className="text-3xl font-bold text-indigo-600">{calcResult.totalPrice.toLocaleString()} kr</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8 mb-8">
                            <div>
                                <h3 className="font-semibold mb-3 text-slate-700">Kostnader</h3>
                                <ul className="space-y-2 text-sm">
                                    <li className="flex justify-between"><span>Material:</span> <span>{calcResult.costMaterials.toLocaleString()} kr</span></li>
                                    <li className="flex justify-between"><span>Arbete ({calcResult.totalHours}h):</span> <span>{calcResult.costLabor.toLocaleString()} kr</span></li>
                                    <li className="flex justify-between text-slate-400 border-t pt-2"><span>Netto (Innan påslag):</span> <span>{(calcResult.costMaterials + calcResult.costLabor).toLocaleString()} kr</span></li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="font-semibold mb-3 text-slate-700">Vinst & Risk</h3>
                                <ul className="space-y-2 text-sm">
                                    <li className="flex justify-between"><span>Netto Vinst:</span> <span className="text-emerald-600 font-bold">+{calcResult.netProfit.toLocaleString()} kr</span></li>
                                </ul>
                            </div>
                        </div>

                        {calcResult.kmaFlags && calcResult.kmaFlags.length > 0 && (
                            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 mb-6">
                                <h4 className="font-semibold text-amber-800 flex items-center gap-2 mb-2"><AlertCircle size={16} /> KMA-Risker identifierade:</h4>
                                <ul className="list-disc list-inside text-sm text-amber-900">
                                    {calcResult.kmaFlags.map((f: string, i: number) => <li key={i}>{f}</li>)}
                                </ul>
                            </div>
                        )}

                    </div>

                    <button
                        onClick={handleGeneratePdf}
                        disabled={loading}
                        className="btn-primary w-full py-4 text-lg bg-emerald-600 text-white rounded-xl shadow-lg disabled:opacity-50 hover:bg-emerald-700 transition-colors flex justify-center items-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <><FileText /> Generera Offert PDF</>}
                    </button>
                </div>
            )}

            {/* STEP 4: SUCCESS */}
            {step === 4 && pdfResult && (
                <div className="text-center animate-in zoom-in duration-300">
                    <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Check size={48} />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">Offert Skapad!</h2>
                    <p className="text-slate-600 mb-8 max-w-lg mx-auto">
                        Offerten har genererats och sparats. Du kan nu ladda ner den eller skicka den till kunden.
                    </p>

                    <div className="flex justify-center gap-4">
                        <a href={pdfResult.webViewLink} target="_blank" rel="noopener noreferrer" className="bg-indigo-600 text-white px-8 py-3 rounded-lg shadow-lg hover:bg-indigo-700 transition-colors font-medium flex items-center gap-2">
                            <FileText size={18} /> Öppna PDF
                        </a>
                        <Link href="/offers" className="bg-slate-200 text-slate-700 px-8 py-3 rounded-lg hover:bg-slate-300 transition-colors font-medium">
                            Tillbaks till listan
                        </Link>
                    </div>
                </div>
            )}

        </div>
    );
}
