import 'server-only';
import { db } from './server';
import { Timestamp } from 'firebase-admin/firestore';

export interface ChangeOrderData {
    id: string;
    projectId: string;
    description: string;
    quantity: number;
    unit?: string;
    estimatedCost: number; // Exkl moms
    type: 'material' | 'work' | 'other';
    status: 'draft' | 'approved' | 'rejected';
    createdAt: Timestamp;
    approvedAt?: Timestamp;
    driveFileId?: string; // If a separate doc is created
}

const COLLECTION = 'change_orders';

export const ChangeOrderRepo = {
    async create(data: Omit<ChangeOrderData, 'id' | 'createdAt' | 'status'>) {
        const docRef = db.collection(COLLECTION).doc();
        const newOrder: ChangeOrderData = {
            id: docRef.id,
            ...data,
            status: 'draft', // Always start as draft
            createdAt: Timestamp.now(),
        };
        await docRef.set(newOrder);
        return newOrder;
    },

    async listByProject(projectId: string): Promise<ChangeOrderData[]> {
        const snapshot = await db
            .collection(COLLECTION)
            .where('projectId', '==', projectId)
            .orderBy('createdAt', 'desc')
            .get();
        return snapshot.docs.map(doc => doc.data() as ChangeOrderData);
    },

    async updateStatus(id: string, status: 'approved' | 'rejected') {
        await db.collection(COLLECTION).doc(id).update({
            status,
            approvedAt: status === 'approved' ? Timestamp.now() : undefined
        });
    }
};
