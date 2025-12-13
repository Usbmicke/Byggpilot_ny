import 'server-only';
import { RiskRepo } from '@/lib/dal/risk.repo';

/**
 * "The Putter" - Recursive/Reactive Risk Engine
 * Scans project data for keywords and generates risk items.
 */
export const RiskEngine = {
    async scanProject(projectId: string, description: string, name: string) {
        console.log(`⛳ [The Putter] Scanning Project: ${name} (ID: ${projectId})`);

        // 1. Fetch Existing Risks (Stateful Memory)
        const existingRisks = await RiskRepo.listByProject(projectId);
        const existingMap = new Set(existingRisks.map(r => r.type + ':' + r.description.substring(0, 10))); // Simple hash

        const text = (description + " " + name).toLowerCase();
        const detectedRisks = [];

        // --- RULES & LOGIC ---

        // 1. Asbestos (Old houses)
        if (text.includes('1970') || text.includes('1960') || text.includes('miljonprogram') || text.includes('eternit')) {
            detectedRisks.push({
                type: 'kma',
                severity: 'high',
                description: 'Risk för Asbest (Eternit/Årtal). Sanktionsavgift 50 000 kr. Krav på utbildningsbevis.',
                keywords: ['eternit', '1960', '1970']
            });
        }

        // 2. Silica Dust (Concrete, Håltagning)
        if (text.includes('betong') || text.includes('håltagning') || text.includes('riva vägg') || text.includes('bilning')) {
            detectedRisks.push({
                type: 'kma',
                severity: 'medium',
                description: 'Kvartsdamm. Kräver tjänstbarhetsintyg och dammsugare H-klass.',
                keywords: ['betong', 'bilning']
            });
        }

        // 3. Fall Height / Scaffolding (Tak, Fasad, Ställning)
        // Updated: Directive Tone
        if (text.includes('tak') || text.includes('fasad') || text.includes('nock') || text.includes('vindskivor') || text.includes('måla hus')) {
            detectedRisks.push({
                type: 'kma',
                severity: 'high',
                description: 'Fallrisk/Ställning (>2m). Rekommendation: Använd UE för ställningsbyggande (Kräver utbildningsbevis).',
                keywords: ['tak', 'fasad', 'ställning']
            });
        }

        // 4. Vibration (HAVS) - NEW
        if (text.includes('bilning') || text.includes('slagborr') || text.includes('tigersåg')) {
            detectedRisks.push({
                type: 'kma',
                severity: 'medium',
                description: 'Vibrationer (HAVS). Rekommendation: Hyr vibrationsdämpade maskiner och fakturera kostnaden.',
                keywords: ['bilning', 'tigersåg']
            });
        }

        // 5. Hot Work (Svets, Papptak, Kapa) - Updated Profit Hint
        if (text.includes('papptak') || text.includes('svets') || text.includes('vinkelslip') || text.includes('takpapp')) {
            detectedRisks.push({
                type: 'kma',
                severity: 'high',
                description: 'Heta Arbeten. Krav på Brandvakt. Säkerställ att brandvakten faktureras som extra resurs.',
                keywords: ['svets', 'papptak']
            });
        }

        // 6. Chemicals (Badrum, Isocyanater)
        if (text.includes('badrum') || text.includes('fog') || text.includes('epoxi') || text.includes('lim')) {
            detectedRisks.push({
                type: 'kma',
                severity: 'medium',
                description: 'Kemiska hälsorisker (Härdplaster?). Kontrollera produktblad. Vid isocyanater krävs utbildning.',
                keywords: ['badrum', 'fog', 'epoxi']
            });
        }

        // 7. Financial Risk (Löpande utan tak, Muntliga avtal)
        if (text.includes('löpande') && !text.includes('takpris')) {
            detectedRisks.push({
                type: 'financial',
                severity: 'medium',
                description: 'Ekonomisk Risk: Löpande räkning utan takpris. Rekommendation: Definiera budgettak för att undvika tvist.',
                keywords: ['löpande']
            });
        }
        if (text.includes('muntligt')) {
            detectedRisks.push({
                type: 'financial',
                severity: 'high',
                description: 'Hög Risk: Muntliga överenskommelser. Rekommendation: Skriv alltid avtal för att säkra betalning!',
                keywords: ['muntligt']
            });
        }

        // 8. Time/Winter Risk (Profit Driven)
        const currentMonth = new Date().getMonth(); // 0-11
        const isWinter = currentMonth >= 10 || currentMonth <= 2; // Nov-Mar
        if (isWinter && (text.includes('utomhus') || text.includes('fasad') || text.includes('tak') || text.includes('grund'))) {
            detectedRisks.push({
                type: 'time',
                severity: 'medium',
                description: 'Vinterarbete. Rekommendation: Skapa ÄTA för Snöskottning & Byggström (Uppvärmning).',
                keywords: ['vinter', 'utomhus']
            });
        }

        // 9. Electricity (Behörighet)
        if (text.includes('el') || text.includes('kabel') || text.includes('uttag')) {
            detectedRisks.push({
                type: 'kma',
                severity: 'high',
                description: 'El-arbeten. Rekommendation: Använd behörig elektriker och dokumentera egenkontroll.',
                keywords: ['el', 'kabel']
            });
        }

        // --- FILTER & SAVE ---
        let newCount = 0;
        for (const risk of detectedRisks) {
            // Fuzzy check if already exists
            const key = risk.type + ':' + risk.description.substring(0, 10);

            // IF ALREADY EXISTS (Managed/Ignored/Detected) -> SKIP
            // The "Stateful" Rule: Don't nag if DB knows about it.
            if (existingMap.has(key)) {
                console.log(`  -> Skipping known risk: ${risk.description.substring(0, 20)}...`);
                continue;
            }

            // Create New
            console.log(`  -> New Risk Detected: ${risk.description}`);
            await RiskRepo.create({
                projectId,
                type: risk.type as any,
                severity: risk.severity as any,
                description: risk.description,
                detectedKeywords: risk.keywords,
                status: 'detected'
            });
            newCount++;
        }

        return newCount;
    }
};
