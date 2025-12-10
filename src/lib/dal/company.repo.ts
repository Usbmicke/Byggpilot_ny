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

export interface CompanyProfile {
    name: string;
    orgNumber: string;
    address: string;
    contactEmail?: string;
    contactPhone?: string;
    logoUrl?: string; // URL to storage
}

export interface CompanyContext {
    preferences?: string; // e.g. "Vi föredrar Byggmax", "Vi använder inte gips från X"
    risks?: string; // e.g. "Har haft problem med fuktskador i källare förr"
}

export interface CompanyData {
    name: string;
    ownerId: string;
    createdAt: Timestamp;
    settings?: any;
    driveStructure?: DriveStructure;
    profile?: CompanyProfile;
    context?: CompanyContext;
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
    },

    async updateProfile(companyId: string, data: { profile?: CompanyProfile; context?: CompanyContext }) {
        await db.collection(COLLECTION).doc(companyId).set(
            { ...data },
            { merge: true }
        );
    }
};
