import 'server-only';
import { db } from './server';
import { Timestamp } from 'firebase-admin/firestore';

export interface ProjectData {
    id: string;
    name: string;
    status: 'active' | 'completed' | 'paused' | 'archived';
    address?: string;
    customerName?: string;
    customerId?: string; // Link to Customer Collection
    description?: string;
    createdAt: Timestamp;
    ownerId: string;
    driveFolderId?: string;
    projectNumber?: string;
    team?: {
        contactId: string;
        role: string; // e.g. "Elansvarig", "Rörläggare"
        isMainContact?: boolean; // If they are the "Huvudansvarig" for their domain or the proj.
    }[];
}

const COLLECTION = 'projects';

export const ProjectRepo = {
    async listByOwner(ownerId: string, limit: number = 100): Promise<ProjectData[]> {
        const snapshot = await db
            .collection(COLLECTION)
            .where('ownerId', '==', ownerId)
            .limit(limit)
            // .orderBy('createdAt', 'desc') // Requires index
            .get();

        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectData));
    },

    async listByCustomer(customerId: string): Promise<ProjectData[]> {
        const snapshot = await db
            .collection(COLLECTION)
            .where('customerId', '==', customerId)
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProjectData));
    },

    async get(id: string): Promise<ProjectData | null> {
        const doc = await db.collection(COLLECTION).doc(id).get();
        if (!doc.exists) return null;
        return { id: doc.id, ...doc.data() } as ProjectData;
    },

    async create(data: Omit<ProjectData, 'id' | 'createdAt'>) {
        const docRef = db.collection(COLLECTION).doc();
        const newProject: ProjectData = {
            id: docRef.id,
            ...data,
            createdAt: Timestamp.now(),
        };

        // Sanitize: Firestore throws on 'undefined', so we remove those keys.
        const msg = { ...newProject };
        Object.keys(msg).forEach(key => {
            if ((msg as any)[key] === undefined) delete (msg as any)[key];
        });

        await docRef.set(msg as ProjectData); // Cast back or just send msg
        return newProject;
    },

    async update(id: string, data: Partial<ProjectData>) {
        // Sanitize
        const msg = { ...data };
        Object.keys(msg).forEach(key => {
            if ((msg as any)[key] === undefined) delete (msg as any)[key];
        });

        await db.collection(COLLECTION).doc(id).set(msg, { merge: true });
    },

    async delete(id: string) {
        await db.collection(COLLECTION).doc(id).delete();
    }
};
