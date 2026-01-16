'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, FileText, Banknote, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface CriticalItem {
    id: string;
    type: 'invoice' | 'ata' | 'risk';
    title: string;
    subtitle: string;
    severity: 'high' | 'medium';
    link: string;
}

export default function CriticalStopsWidget() {
    const [items, setItems] = useState<CriticalItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch critical items
        // In a real app, this would be an aggregated server action.
        // For now, we simulate fetching draft ÄTAs and overdue invoices.
        import('@/app/actions').then(async ({ getCriticalStopsAction }) => {
            if (getCriticalStopsAction) {
                const res = await getCriticalStopsAction();
                if (res.success && res.items) {
                    setItems(res.items);
                }
            }
            setLoading(false);
        });
    }, []);

    if (loading) return <div className="h-32 bg-card rounded-xl animate-pulse" />;

    // Only show if there are items
    if (items.length === 0) return null;

    return (
        <div className="bg-card rounded-xl shadow-lg border border-red-200 overflow-hidden">
            <div className="bg-red-50 p-4 border-b border-red-100 flex items-center gap-3">
                <AlertCircle className="text-red-600" size={20} />
                <h3 className="font-bold text-red-900">Kritiska Stopp ({items.length})</h3>
            </div>

            <div className="divide-y divide-border">
                {items.map(item => (
                    <Link key={item.id} href={item.link} className="block p-4 hover:bg-zinc-50 transition-colors group">
                        <div className="flex justify-between items-start">
                            <div className="flex gap-3">
                                <div className={`mt-1 p-1.5 rounded-full shrink-0 ${item.type === 'invoice' ? 'bg-red-100 text-red-600' :
                                    item.type === 'ata' ? 'bg-amber-100 text-amber-600' : 'bg-orange-100 text-orange-600'
                                    }`}>
                                    {item.type === 'invoice' && <Banknote size={16} />}
                                    {item.type === 'ata' && <FileText size={16} />}
                                    {item.type === 'risk' && <AlertTriangle size={16} />}
                                </div>
                                <div>
                                    <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">{item.title}</h4>
                                    <p className="text-sm text-muted-foreground">{item.subtitle}</p>
                                </div>
                            </div>
                            <div className="bg-white border border-zinc-200 text-xs font-bold px-2 py-1 rounded shadow-sm group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-colors">
                                Åtgärda &rarr;
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
