'use client';

export default function QuickLog() {
    return (
        <div className="bg-white rounded-lg shadow p-4">
            <h3 className="font-medium text-gray-900 mb-3">Snabbrapportering</h3>
            <div className="flex gap-2">
                <select className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2">
                    <option>Välj projekt...</option>
                </select>
                <button className="px-3 py-2 bg-green-600 text-white rounded text-sm whitespace-nowrap">
                    Starta
                </button>
            </div>
        </div>
    );
}
