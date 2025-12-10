import 'server-only';
import { db } from './server';
import { Timestamp } from 'firebase-admin/firestore';

export interface RiskData {
    id: string;
    projectId: string;
    type: 'kma' | 'financial' | 'time' | 'other';
    description: string;
    detectedKeywords: string[];
    severity: 'low' | 'medium' | 'high';
    status: 'detected' | 'mitigated' | 'ignored';
    createdAt: Timestamp;
}

const COLLECTION = 'risks';

export const RiskRepo = {
    async create(data: Omit<RiskData, 'id' | 'createdAt'>): Promise<RiskData> {
        const docRef = db.collection(COLLECTION).doc();
        const newRisk: RiskData = {
            id: docRef.id,
            ...data,
            createdAt: Timestamp.now(),
        };
        await docRef.set(newRisk);
        return newRisk;
    },

    async listByProject(projectId: string): Promise<RiskData[]> {
        const snapshot = await db.collection(COLLECTION)
            .where('projectId', '==', projectId)
            .get();
        return snapshot.docs.map(doc => doc.data() as RiskData);
    },

    async updateStatus(id: string, status: RiskData['status']) {
        await db.collection(COLLECTION).doc(id).update({ status });
    },

    // To clear previous auto-detected risks when re-scanning
    async deleteAutoDetected(projectId: string) {
        const snapshot = await db.collection(COLLECTION)
            .where('projectId', '==', projectId)
            .where('status', '==', 'detected')
            .get();

        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
};
