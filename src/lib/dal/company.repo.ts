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
    projectCounter?: number; // Last used project number
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
        const updateData: any = { ...data };
        // Sync root "name" if profile "name" is updated, to keep folder structure consistent
        if (data.profile?.name) {
            updateData.name = data.profile.name;
        }

        await db.collection(COLLECTION).doc(companyId).set(
            updateData,
            { merge: true }
        );
    },

    async getNextProjectNumber(companyId: string): Promise<number> {
        const ref = db.collection(COLLECTION).doc(companyId);

        return await db.runTransaction(async (t) => {
            const doc = await t.get(ref);
            if (!doc.exists) throw new Error("Company not found");

            const data = doc.data() as CompanyData;
            let current = data.projectCounter;

            // Random Start if missing
            if (!current) {
                // Generate random start between 3000 and 6000
                current = Math.floor(Math.random() * (6000 - 3000 + 1) + 3000);
            } else {
                current += 1;
            }

            t.set(ref, { projectCounter: current }, { merge: true });
            return current;
        });
    }
};
