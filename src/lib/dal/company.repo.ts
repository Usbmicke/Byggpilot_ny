import 'server-only';
import { db } from './server';
import { Timestamp } from 'firebase-admin/firestore';

export interface DriveStructure {
    rootId: string;
    customersId?: string;
    projectsId?: string;
    documentationId?: string;
    offersId?: string;
}

export interface CompanyData {
    name: string;
    ownerId: string;
    createdAt: Timestamp;
    settings?: any;
    driveStructure?: DriveStructure;
}

const COLLECTION = 'companies';

export const CompanyRepo = {
    async get(companyId: string): Promise<CompanyData | null> {
        const doc = await db.collection(COLLECTION).doc(companyId).get();
        if (!doc.exists) return null;
        return doc.data() as CompanyData;
    },

    async updateDriveStructure(companyId: string, structure: DriveStructure) {
        await db.collection(COLLECTION).doc(companyId).set(
            { driveStructure: structure },
            { merge: true }
        );
    }
};
