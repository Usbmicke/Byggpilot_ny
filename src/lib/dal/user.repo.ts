import 'server-only';
import { db } from './server';
import { UserRecord } from 'firebase-admin/auth';
import { Timestamp } from 'firebase-admin/firestore';

// Define the User interface matching Firestore document structure
export interface UserData {
    uid: string;
    email: string | null;
    displayName: string | null;
    companyId: string;
    onboardingCompleted: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

const COLLECTION = 'users';

export const UserRepo = {
    async get(uid: string): Promise<UserData | null> {
        // DEV MOCK
        if (process.env.NODE_ENV === 'development' && uid === 'dev-user-123') {
            return {
                uid: 'dev-user-123',
                email: 'dev@test.se',
                displayName: 'Dev User',
                companyId: 'dev-company-abc',
                onboardingCompleted: true,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now()
            };
        }
        const doc = await db.collection(COLLECTION).doc(uid).get();
        if (!doc.exists) return null;
        return doc.data() as UserData;
    },

    async createOrUpdate(uid: string, data: Partial<UserData>) {
        await db.collection(COLLECTION).doc(uid).set(
            {
                ...data,
                updatedAt: Timestamp.now(),
            },
            { merge: true }
        );
    },

    async ensureUser(uid: string, email?: string): Promise<UserData> {
        const existing = await this.get(uid);
        if (existing) return existing;

        const newUser: UserData = {
            uid,
            email: email || null,
            displayName: null,
            companyId: '',
            onboardingCompleted: false,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        await db.collection(COLLECTION).doc(uid).set(newUser);
        return newUser;
    },

    async update(uid: string, data: Partial<UserData>) {
        return this.createOrUpdate(uid, data);
    }
};
