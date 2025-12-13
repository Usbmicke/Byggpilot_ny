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
    driveFileId?: string;
    driveWebViewLink?: string;
    approvalMethod?: 'link' | 'email' | 'manual';
    approvalEvidence?: string; // e.g. "Email from anna@test.se" or "IP: 127.0.0.1"
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
            .get();
        // Sort in memory to avoid Composite Index requirement
        const docs = snapshot.docs.map(doc => doc.data() as ChangeOrderData);
        return docs.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    },

    async updateStatus(id: string, status: 'approved' | 'rejected', method: 'link' | 'email' | 'manual' = 'manual', evidence: string = '') {
        await db.collection(COLLECTION).doc(id).update({
            status,
            approvedAt: status === 'approved' ? Timestamp.now() : undefined,
            approvalMethod: method,
            approvalEvidence: evidence
        });
    },

    async get(id: string): Promise<ChangeOrderData | null> {
        const doc = await db.collection(COLLECTION).doc(id).get();
        if (!doc.exists) return null;
        return doc.data() as ChangeOrderData;
    },

    async updatePdf(id: string, driveFileId: string, driveWebViewLink: string) {
        await db.collection(COLLECTION).doc(id).update({
            driveFileId,
            driveWebViewLink
        });
    }
};
