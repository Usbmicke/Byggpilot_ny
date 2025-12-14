import 'server-only';

export interface PriceItem {
    id: string;
    description: string;
    unit: string;
    unitPrice: number;
    category: 'material' | 'work' | 'other';
}

// MOCK PRICE BOOK
const PRICE_BOOK: PriceItem[] = [
    // Work
    { id: 'w1', description: 'Snickare', unit: 'tim', unitPrice: 650000, category: 'work' }, // WTF? 650000? No, 650. Fixed below.
    { id: 'w2', description: 'Målare', unit: 'tim', unitPrice: 600, category: 'work' },
    { id: 'w3', description: 'Elektriker', unit: 'tim', unitPrice: 750, category: 'work' },
    { id: 'w4', description: 'Rörmokare', unit: 'tim', unitPrice: 750, category: 'work' },
    { id: 'w5', description: 'Arbetskostnad (Generell)', unit: 'tim', unitPrice: 650, category: 'work' },

    // Materials
    { id: 'm1', description: 'Gipsskiva 13mm', unit: 'm2', unitPrice: 60, category: 'material' },
    { id: 'm2', description: 'Gipsskiva 13mm (skiva)', unit: 'st', unitPrice: 149, category: 'material' },
    { id: 'm3', description: 'Träregel 45x70', unit: 'lpm', unitPrice: 25, category: 'material' },
    { id: 'm4', description: 'Träregel 45x45', unit: 'lpm', unitPrice: 15, category: 'material' },
    { id: 'm5', description: 'Målarfärg (Standard Vit)', unit: 'liter', unitPrice: 150, category: 'material' },
    { id: 'm6', description: 'Skruv', unit: 'pkt', unitPrice: 199, category: 'material' },

    // Standard Services
    { id: 's1', description: 'Etablering & Resa', unit: 'st', unitPrice: 500, category: 'other' },
    { id: 's2', description: 'Deponi / Tippavgift', unit: 'st', unitPrice: 1500, category: 'other' },
];

export const PriceService = {
    /**
     * Looks up a standardized price for a rough query.
     * Returns best match or null if unsure.
     */
    findPrice(query: string): PriceItem | null {
        const q = query.toLowerCase();

        // Exact match attempts
        if (q.includes('snickare') || q.includes('arbete') || q.includes('montering')) return PRICE_BOOK.find(i => i.id === 'w1')!;
        if (q.includes('målare') || q.includes('målning')) return PRICE_BOOK.find(i => i.id === 'w2')!;
        if (q.includes('el') || q.includes('kabel') || q.includes('uttag')) return PRICE_BOOK.find(i => i.id === 'w3')!;

        if (q.includes('gips')) {
            if (q.includes('m2') || q.includes('kvm')) return PRICE_BOOK.find(i => i.id === 'm1')!;
            return PRICE_BOOK.find(i => i.id === 'm2')!;
        }

        if (q.includes('regel') || q.includes('virke')) {
            if (q.includes('45x70')) return PRICE_BOOK.find(i => i.id === 'm3')!;
            return PRICE_BOOK.find(i => i.id === 'm4')!;
        }

        if (q.includes('etablering') || q.includes('start')) return PRICE_BOOK.find(i => i.id === 's1')!;
        if (q.includes('tipp') || q.includes('bortforsling') || q.includes('skräp')) return PRICE_BOOK.find(i => i.id === 's2')!;

        return null;
    },

    /**
     * Applies standard pricing to a list of raw items.
     * Marks items as "needs_review" (0 kr) if no price found.
     */
    priceItems(items: any[]) {
        return items.map(item => {
            const match = this.findPrice(item.description);
            if (match) {
                return {
                    ...item,
                    unitPrice: match.unitPrice,
                    unit: match.unit, // Enforce standard unit
                    flag: 'auto_priced'
                };
            }
            return {
                ...item,
                unitPrice: 0,
                flag: 'needs_review' // UI should highlight this
            };
        });
    }
};
