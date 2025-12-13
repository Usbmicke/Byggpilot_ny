import 'server-only';
import { db } from './server';
import { Timestamp } from 'firebase-admin/firestore';

export interface OfferItem {
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
}

export interface OfferData {
    id: string;
    projectId?: string; // Optional if created without project first
    title: string;
    items: OfferItem[];
    totalAmount: number;
    vatAmount: number;
    introText?: string;
    closingText?: string;
    status: 'draft' | 'sent' | 'accepted' | 'rejected';
    createdAt: Timestamp;
    updatedAt: Timestamp;
    ownerId: string;
}

const COLLECTION = 'offers';

export const OfferRepo = {
    async listByOwner(ownerId: string): Promise<OfferData[]> {
        const snapshot = await db
            .collection(COLLECTION)
            .where('ownerId', '==', ownerId)
            // .orderBy('createdAt', 'desc')
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OfferData));
    },

    async listByProject(projectId: string): Promise<OfferData[]> {
        const snapshot = await db
            .collection(COLLECTION)
            .where('projectId', '==', projectId)
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OfferData));
    },

    async getById(id: string): Promise<OfferData | null> {
        const doc = await db.collection(COLLECTION).doc(id).get();
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() } as OfferData;
    },

    async create(data: Omit<OfferData, 'id' | 'createdAt' | 'updatedAt'>) {
        const docRef = db.collection(COLLECTION).doc();
        const newOffer: OfferData = {
            id: docRef.id,
            ...data,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        };
        await docRef.set(newOffer);
        return newOffer;
    },

    async update(id: string, data: Partial<Omit<OfferData, 'id' | 'createdAt' | 'ownerId'>>) {
        const docRef = db.collection(COLLECTION).doc(id);
        await docRef.update({
            ...data,
            updatedAt: Timestamp.now()
        });
        return { id, ...data }; // Return partial for confirmation
    }
};
