'use client';

export default function QuickLog() {
    return (
        <div className="p-0">
            <div className="flex gap-2">
                <select className="block w-full rounded-md border-border bg-[#383A40] text-foreground shadow-sm focus:border-primary focus:ring-primary sm:text-sm border p-2 focus:outline-none">
                    <option>Välj projekt...</option>
                </select>
                <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md text-sm whitespace-nowrap transition-colors shadow-lg shadow-green-900/20">
                    Starta
                </button>
            </div>
        </div>
    );
}
