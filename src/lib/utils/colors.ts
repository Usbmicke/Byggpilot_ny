export const PASTEL_COLORS = [
    { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', ring: 'ring-blue-500' },
    { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', ring: 'ring-green-500' },
    { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', ring: 'ring-purple-500' },
    { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', ring: 'ring-amber-500' },
    { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-200', ring: 'ring-rose-500' },
    { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200', ring: 'ring-indigo-500' },
    { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200', ring: 'ring-teal-500' },
    { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200', ring: 'ring-cyan-500' },
];

export function getItemColor(seed: string) {
    if (!seed) return PASTEL_COLORS[0];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % PASTEL_COLORS.length;
    return PASTEL_COLORS[index];
}
