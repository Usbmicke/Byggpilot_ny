'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getOffersAction } from '@/app/actions';
import Link from 'next/link';
import { Plus, FileText } from 'lucide-react';

export default function OffersPage() {
    const { user } = useAuth();
    const [offers, setOffers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        getOffersAction(user.uid).then(res => {
            if (res.success && res.offers) setOffers(res.offers);
            setLoading(false);
        });
    }, [user]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Mina Offerter</h1>
                    <p className="text-gray-500">Skapa och hantera dina offerter.</p>
                </div>
                <Link
                    href="/offers/create"
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <Plus size={20} />
                    Ny Offert
                </Link>
            </div>

            {loading ? (
                <div className="grid gap-4">
                    {[1, 2].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse"></div>)}
                </div>
            ) : offers.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                    <h3 className="text-lg font-medium text-gray-900">Inga offerter än</h3>
                    <p className="text-gray-500 mb-6">Använd AI-motorn för att skapa din första offert på sekunder.</p>
                    <Link
                        href="/offers/create"
                        className="text-indigo-600 font-medium hover:underline"
                    >
                        Skapa en nu &rarr;
                    </Link>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Titel</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kund/Projekt</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Belopp</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Datum</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {offers.map((offer) => (
                                <tr key={offer.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-indigo-100 rounded text-indigo-600">
                                                <FileText size={20} />
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">{offer.title}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {/* Placeholder for project name or customer */}
                                        Projekt ID: {offer.projectId?.substring(0, 5)}...
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                                        {(offer.totalAmount + offer.vatAmount).toLocaleString('sv-SE')} kr
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                        {new Date(offer.createdAt).toLocaleDateString('sv-SE')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                            {offer.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
