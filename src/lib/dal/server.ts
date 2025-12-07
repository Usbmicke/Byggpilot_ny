import 'server-only';
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'byggpilot-v2',
    });
}

// Global Fix: Ignore "undefined" fields in Firestore calls (prevents crashes)
try {
    admin.firestore().settings({ ignoreUndefinedProperties: true });
} catch (e) {
    // Settings might be locked if already accessed, ignore.
}

export const auth = admin.auth();
export const db = admin.firestore();
