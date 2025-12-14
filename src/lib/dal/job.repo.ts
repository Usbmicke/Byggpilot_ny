import 'server-only';
import { db } from './server';
import { Timestamp } from 'firebase-admin/firestore';

export interface JobData {
    id: string;
    type: 'generate_offer' | 'create_invoice' | 'analyze_document';
    status: 'pending' | 'processing' | 'completed' | 'failed';
    data: any; // Input data for the job
    result?: any; // Output data/links
    error?: string;
    userId: string;
    projectId?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    completedAt?: Timestamp;
}

const COLLECTION = 'jobs';

export const JobRepo = {
    async create(type: JobData['type'], userId: string, data: any, projectId?: string): Promise<JobData> {
        const docRef = db.collection(COLLECTION).doc();
        const job: JobData = {
            id: docRef.id,
            type,
            status: 'pending',
            data,
            userId,
            projectId,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };
        await docRef.set(job);
        return job;
    },

    async updateStatus(id: string, status: JobData['status'], result?: any, error?: string) {
        const updates: any = {
            status,
            updatedAt: Timestamp.now()
        };

        if (result) updates.result = result;
        if (error) updates.error = error;
        if (status === 'completed' || status === 'failed') updates.completedAt = Timestamp.now();

        await db.collection(COLLECTION).doc(id).update(updates);
    },

    async get(id: string): Promise<JobData | null> {
        const doc = await db.collection(COLLECTION).doc(id).get();
        if (!doc.exists) return null;
        return doc.data() as JobData;
    }
};
