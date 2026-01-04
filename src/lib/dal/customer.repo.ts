import 'server-only';
import { db } from './server';
import { Timestamp } from 'firebase-admin/firestore';

export interface CustomerData {
    id: string;
    companyId: string; // The construction company that owns this customer record
    name: string;
    type: 'private' | 'company' | 'subcontractor';
    role?: string; // e.g. "Electrician", "Plumber" (Mostly for subcontractors)
    orgNumber?: string; // SSN or OrgNr
    email?: string;
    phone?: string;
    address?: string; // Multi-line address string
    status: 'lead' | 'active' | 'inactive';
    notes?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    completeness: number; // 0-100 score indicating if profile is "Yellow Dot" ready
}

const COLLECTION = 'customers';

export const CustomerRepo = {
    async create(data: Omit<CustomerData, 'id' | 'createdAt' | 'updatedAt' | 'completeness'>): Promise<CustomerData> {
        const docRef = db.collection(COLLECTION).doc();
        const completeness = calculateCompleteness(data);

        const newCustomer: CustomerData = {
            id: docRef.id,
            ...data,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            completeness
        };

        await docRef.set(newCustomer);
        return newCustomer;
    },

    async update(id: string, data: Partial<Omit<CustomerData, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
        const docRef = db.collection(COLLECTION).doc(id);
        const snap = await docRef.get();
        if (!snap.exists) throw new Error('Customer not found');

        const existing = snap.data() as CustomerData;
        const merged = { ...existing, ...data };
        const completeness = calculateCompleteness(merged);

        await docRef.update({
            ...data,
            updatedAt: Timestamp.now(),
            completeness
        });
    },

    async get(id: string): Promise<CustomerData | null> {
        const doc = await db.collection(COLLECTION).doc(id).get();
        if (!doc.exists) return null;
        return doc.data() as CustomerData;
    },

    async listByCompany(companyId: string, limit: number = 100): Promise<CustomerData[]> {
        const snap = await db.collection(COLLECTION)
            .where('companyId', '==', companyId)
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();
        return snap.docs.map(d => d.data() as CustomerData);
    },

    async delete(id: string): Promise<void> {
        // SAFETY CHECK: Do not delete if customer has active projects
        const { ProjectRepo } = await import('@/lib/dal/project.repo');
        const projects = await ProjectRepo.listByCustomer(id);

        // Check for ANY non-archived projects
        const activeProjects = projects.filter(p => p.status !== 'archived');

        if (activeProjects.length > 0) {
            throw new Error(`Cannot delete customer. They have ${activeProjects.length} active/completed projects. Archive projects first.`);
        }

        await db.collection(COLLECTION).doc(id).delete();
    }
};

// Helper: Calculate completeness score
function calculateCompleteness(data: Partial<CustomerData>): number {
    let score = 0;
    let total = 0;

    // Critical fields
    const critical = ['name', 'address', 'orgNumber', 'phone', 'email'];

    critical.forEach(field => {
        total++;
        // @ts-ignore
        if (data[field] && data[field].length > 2) score++;
    });

    return Math.round((score / total) * 100);
}
