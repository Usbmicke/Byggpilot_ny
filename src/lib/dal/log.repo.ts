import 'server-only';
import { db } from './server';
import { Timestamp } from 'firebase-admin/firestore';

export interface WorkLog {
    id: string;
    projectId: string;
    userId: string;
    type: 'time' | 'mileage';
    amount: number; // Hours or Kilometers
    description?: string;
    date: Timestamp;
    billed: boolean;
    invoiceId?: string;
    createdAt: Timestamp;
}

const COLLECTION = 'work_logs';

export const LogRepo = {
    async create(data: Omit<WorkLog, 'id' | 'createdAt' | 'billed' | 'date'> & { date?: Date }) {
        const docRef = db.collection(COLLECTION).doc();
        const now = Timestamp.now();
        const logData: WorkLog = {
            id: docRef.id,
            projectId: data.projectId,
            userId: data.userId,
            type: data.type,
            amount: data.amount,
            description: data.description || '',
            date: data.date ? Timestamp.fromDate(data.date) : now,
            billed: false, // Default to unbilled
            createdAt: now
        };

        await docRef.set(logData);
        return logData;
    },

    async listUnbilledByProject(projectId: string): Promise<WorkLog[]> {
        const snapshot = await db.collection(COLLECTION)
            .where('projectId', '==', projectId)
            .where('billed', '==', false)
            .orderBy('date', 'desc') // Show newest first
            .get();

        return snapshot.docs.map(doc => doc.data() as WorkLog);
    },

    async markAsBilled(logIds: string[], invoiceId: string) {
        if (logIds.length === 0) return;

        const batch = db.batch();
        logIds.forEach(id => {
            const ref = db.collection(COLLECTION).doc(id);
            batch.update(ref, { billed: true, invoiceId: invoiceId });
        });
        await batch.commit();
    },

    // Helper to get recent logs for dashboard
    async listRecentByUser(userId: string, limit = 5): Promise<WorkLog[]> {
        const snapshot = await db.collection(COLLECTION)
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();
        return snapshot.docs.map(doc => doc.data() as WorkLog);
    }
};
