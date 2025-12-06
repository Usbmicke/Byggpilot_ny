import 'server-only';
import { db } from './server';
import { UserRecord } from 'firebase-admin/auth';

// Define the User interface matching Firestore document structure
export interface UserData {
    uid: string;
    email: string | null;
    displayName: string | null;
    onboardingCompleted: boolean;
    createdAt: FirebaseFirestore.Timestamp;
    updatedAt: FirebaseFirestore.Timestamp;
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
                updatedAt: db.Timestamp.now() as any, // Cast to any to avoid type issues with different timestamp implementations
            },
            { merge: true }
        );
    }
};
