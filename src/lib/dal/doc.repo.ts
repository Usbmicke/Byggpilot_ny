import 'server-only';
import { db } from './server';
import { Timestamp } from 'firebase-admin/firestore';
import { ErrorHandler } from '@/lib/utils/error.handler';

export interface DocShadow {
    docId: string;           // Google Doc ID
    content: string;         // Plain text content
    lastSyncedAt: Timestamp; // When we last fetched from Google
    driveUrl: string;       // Link
}

const COLLECTION = 'doc_shadow';

/**
 * The 'Shadow DB' preventing Google API Rate Limits.
 * Always read from here first. Sync from Google in background.
 */
export const DocRepo = {
    async get(docId: string): Promise<DocShadow | null> {
        try {
            const doc = await db.collection(COLLECTION).doc(docId).get();
            if (!doc.exists) return null;
            return doc.data() as DocShadow;
        } catch (e) {
            ErrorHandler.captureException(e, { service: 'DocRepo.get', docId });
            return null;
        }
    },

    async set(docId: string, content: string, driveUrl: string) {
        try {
            await db.collection(COLLECTION).doc(docId).set({
                docId,
                content,
                driveUrl,
                lastSyncedAt: Timestamp.now()
            });
        } catch (e) {
            ErrorHandler.captureException(e, { service: 'DocRepo.set', docId });
        }
    }
};
