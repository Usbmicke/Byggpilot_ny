import 'server-only';
import { db } from './server';
import { UserRecord } from 'firebase-admin/auth';
import { Timestamp } from 'firebase-admin/firestore';

// Define the User interface matching Firestore document structure
export interface UserData {
    uid: string;
    email: string | null;
    displayName: string | null;
    onboardingCompleted: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

const COLLECTION = 'users';

export const UserRepo = {
    async get(uid: string): Promise<UserData | null> {
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
    }
};
