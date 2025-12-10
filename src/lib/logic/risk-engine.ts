import 'server-only';
import { RiskRepo } from '@/lib/dal/risk.repo';

/**
 * "The Putter" - Recursive/Reactive Risk Engine
 * Scans project data for keywords and generates risk items.
 */
export const RiskEngine = {
    async scanProject(projectId: string, description: string, name: string) {
        console.log(`⛳ [The Putter] Scanning Project: ${name}`);

        // 1. Clear old auto-detected risks to avoid duplicates
        await RiskRepo.deleteAutoDetected(projectId);

        const text = (description + " " + name).toLowerCase();
        const risksFound = [];

        // --- RULES ---

        // 1. Asbestos (Old houses)
        if (text.includes('1970') || text.includes('1960') || text.includes('miljonprogram') || text.includes('eternit')) {
            risksFound.push({
                type: 'kma',
                severity: 'high',
                description: 'Risk för Asbest (årtal/material). Provtagning rekommenderas.',
                keywords: ['1970', '1960', 'eternit']
            });
        }

        // 2. Silica Dust (Betong, Håltagning)
        if (text.includes('betong') || text.includes('håltagning') || text.includes('riva vägg')) {
            risksFound.push({
                type: 'kma',
                severity: 'medium',
                description: 'Kvartsdamm vid bearbetning av betong/tegel.',
                keywords: ['betong', 'håltagning']
            });
        }

        // 3. Fall Height (Tak, Fasad, Ställning)
        if (text.includes('tak') || text.includes('fasad') || text.includes('nock') || text.includes('vindskivor')) {
            risksFound.push({
                type: 'kma',
                severity: 'high',
                description: 'Fallrisk! Arbete på hög höjd (>2m). Ställning krävs.',
                keywords: ['tak', 'fasad']
            });
        }

        // 4. Hot Work (Svets, Papptak, Kapa)
        if (text.includes('papptak') || text.includes('svets') || text.includes('vinkelslip')) {
            risksFound.push({
                type: 'kma',
                severity: 'high',
                description: 'Heta Arbeten. Certifikat och brandvakt krävs.',
                keywords: ['svets', 'papptak']
            });
        }

        // 5. Chemicals (Badrum, Isocyanater)
        if (text.includes('badrum') || text.includes('fog') || text.includes('epoxi') || text.includes('lim')) {
            risksFound.push({
                type: 'kma',
                severity: 'medium',
                description: 'Kemiska hälsorisker (Härdplaster/Isocyanater?). Kontrollera produktblad.',
                keywords: ['badrum', 'fog', 'epoxi']
            });
        }

        // 6. Financial Risk (Löpande utan tak, Muntliga avtal)
        if (text.includes('löpande') && !text.includes('takpris')) {
            risksFound.push({
                type: 'financial',
                severity: 'medium',
                description: 'Ekonomisk Risk: Löpande räkning utan takpris definierat.',
                keywords: ['löpande']
            });
        }
        if (text.includes('muntligt')) {
            risksFound.push({
                type: 'financial',
                severity: 'high',
                description: 'Hög Risk: Muntliga överenskommelser. Skriv alltid avtal!',
                keywords: ['muntligt']
            });
        }

        // 7. Time Risk (Vinter, Utomhus)
        const currentMonth = new Date().getMonth(); // 0-11
        const isWinter = currentMonth >= 10 || currentMonth <= 2; // Nov-Mar
        if (isWinter && (text.includes('utomhus') || text.includes('fasad') || text.includes('tak') || text.includes('grund'))) {
            risksFound.push({
                type: 'time',
                severity: 'medium',
                description: 'Tidsrisk: Utomhusarbete under vintertid. Planera för väderstopp.',
                keywords: ['vinter', 'utomhus']
            });
        }

        // 8. Electricity (Behörighet)
        if (text.includes('el') || text.includes('kabel') || text.includes('uttag')) {
            risksFound.push({
                type: 'kma',
                severity: 'high',
                description: 'El-arbeten kräver behörig elektriker och egenkontroll.',
                keywords: ['el', 'kabel']
            });
        }

        // --- SAVE ---
        console.log(`⛳ [The Putter] Found ${risksFound.length} risks.`);

        for (const risk of risksFound) {
            await RiskRepo.create({
                projectId,
                type: risk.type as any,
                severity: risk.severity as any,
                description: risk.description,
                detectedKeywords: risk.keywords,
                status: 'detected'
            });
        }

        return risksFound.length;
    }
};
