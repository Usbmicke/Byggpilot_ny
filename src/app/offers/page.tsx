'use client';

import Link from 'next/link';
import { ArrowLeft, Plus, FileText } from 'lucide-react';

export default function OffersPage() {
    return (
        <div className="p-8 max-w-5xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <Link href="/dashboard" className="flex items-center text-slate-500 hover:text-slate-800 transition-colors mb-2">
                        <ArrowLeft size={16} className="mr-1" />
                        Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold text-slate-900">Offerter & Kalkyler</h1>
                    <p className="text-slate-500">Skapa skarpa offerter baserade på dina recept och kalkylmallar.</p>
                </div>

                <Link href="/offers/create">
                    <button className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 flex items-center gap-2 font-medium shadow-md transition-all hover:scale-105">
                        <Plus size={18} /> Skapa ny offert
                    </button>
                </Link>
            </div>

            {/* Empty State / List Placeholder */}
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
                <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Kom igång med kalkylering</h3>
                <p className="text-slate-500 max-w-md mx-auto mb-6">
                    Här samlas dina skapade offerter. Tryck på knappen ovan för att starta guiden och skapa din första offert.
                </p>
                {/* Future: List of saved offers here */}
            </div>
        </div>
    );
}
