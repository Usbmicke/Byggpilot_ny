import 'server-only';
import { db } from './server';
import { Timestamp } from 'firebase-admin/firestore';

export interface ChatMessage {
    id?: string;
    role: 'user' | 'model' | 'system';
    content: string;
    createdAt: Timestamp;
    draft?: any; // For structured outputs/tools like ATA drafts
}

export interface ChatSession {
    id: string;
    userId: string;
    status: 'active' | 'archived';
    createdAt: Timestamp;
    updatedAt: Timestamp;
    lastMessagePreview?: string;
}

const SESSION_COLLECTION = 'chat_sessions';

export const ChatRepo = {
    // Finds the most recent active session for a user, or creates a new one
    async getOrCreateActiveSession(userId: string): Promise<ChatSession> {
        // 1. Try to find active session
        const snapshot = await db.collection(SESSION_COLLECTION)
            .where('userId', '==', userId)
            .where('status', '==', 'active')
            .get();

        if (!snapshot.empty) {
            // Sort in memory to avoid Firestore Composite Index requirement
            const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChatSession));
            docs.sort((a, b) => {
                const timeA = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : 0;
                const timeB = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : 0;
                return timeB - timeA;
            });
            return docs[0];
        }

        // 2. Create new session
        const docRef = db.collection(SESSION_COLLECTION).doc();
        const newSession: ChatSession = {
            id: docRef.id,
            userId,
            status: 'active',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            lastMessagePreview: 'Welcome!'
        };

        await docRef.set(newSession);
        return newSession;
    },

    async archiveActiveSession(userId: string) {
        const snapshot = await db.collection(SESSION_COLLECTION)
            .where('userId', '==', userId)
            .where('status', '==', 'active')
            .get();

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { status: 'archived', updatedAt: Timestamp.now() });
        });
        await batch.commit();
    },

    async addMessage(sessionId: string, role: 'user' | 'model' | 'system', content: string, draft?: any) {
        const sessionRef = db.collection(SESSION_COLLECTION).doc(sessionId);

        // Add to sub-collection 'messages'
        const msgRef = sessionRef.collection('messages').doc();
        const newMessage: ChatMessage = {
            id: msgRef.id,
            role,
            content,
            createdAt: Timestamp.now(),
            draft: draft || null
        };
        await msgRef.set(newMessage);

        // Update session meta
        await sessionRef.update({
            updatedAt: Timestamp.now(),
            lastMessagePreview: content.slice(0, 50) + (content.length > 50 ? '...' : '')
        });

        return newMessage;
    },

    async getHistory(sessionId: string, limit: number = 50): Promise<ChatMessage[]> {
        const snapshot = await db.collection(SESSION_COLLECTION).doc(sessionId)
            .collection('messages')
            .orderBy('createdAt', 'asc') // Create chronological order
            // .limitToLast(limit) // Firestore weirdness with limitToLast + orderBy sometimes.. let's grab all manageable if small
            // We want the LATEST messages, but in ASC order.
            .get();

        // Simple approach: grab them, sort manual if needed, slice.
        const msgs = snapshot.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                role: data.role,
                content: data.content,
                createdAt: data.createdAt,
                draft: data.draft
            } as ChatMessage;
        });

        // Since we ordered by createdAt asc, we have the conversation flow.
        // If we want to limit, we can slice the end.
        return msgs.slice(-limit);
    }
};
