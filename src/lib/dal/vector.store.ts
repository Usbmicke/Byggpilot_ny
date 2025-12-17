import 'server-only';
import { ai } from '@/lib/genkit-instance';
import { db } from '@/lib/dal/server';
import { FieldValue } from 'firebase-admin/firestore';
import { AI_MODELS } from '@/lib/genkit/config';

// Interface for a Knowledge Chunk
export interface KnowledgeChunk {
    id: string;
    content: string;
    source: string; // e.g. "BBR 6:53" or "AFS 1999:3"
    metadata?: any;
}

/**
 * Searches the 'knowledge_chunks' collection for texts semantically similar to the query.
 * @param query The user's search query (e.g. "Regler för tätskikt")
 * @param limit Max number of chunks to return (default 3)
 */
export async function searchKnowledgeBase(query: string, limit: number = 3): Promise<KnowledgeChunk[]> {
    try {
        // 1. Convert Query to Vector
        const embeddingResult = await ai.embed({
            embedder: AI_MODELS.EMBEDDING,
            content: query
        });
        const embedding = (embeddingResult as any).embedding || (Array.isArray(embeddingResult) ? (embeddingResult as any)[0].embedding : []);

        // 2. Perform Vector Search on Firestore
        // Note: This requires a Firestore Vector Index on the 'embedding' field.
        const vectorQuery = db.collection('knowledge_chunks')
            .findNearest('embedding', FieldValue.vector(embedding), {
                limit: limit,
                distanceMeasure: 'COSINE'
            });

        const snapshot = await vectorQuery.get();

        // 3. Map Results
        const results: KnowledgeChunk[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                content: data.content,
                source: data.source,
                metadata: data.metadata
            };
        });

        return results;

    } catch (error) {
        console.warn("Vector Search failed (Index might be missing or empty):", error);
        return [];
    }
}

/**
 * Indexes a text chunk into the Vector Store.
 * Use this in Admin Scripts or specific ingestion flows.
 */
export async function indexKnowledgeChunk(content: string, source: string, metadata: any = {}) {
    // 1. Generate Embedding
    const embeddingResult = await ai.embed({
        embedder: AI_MODELS.EMBEDDING,
        content: content
    });
    const embedding = (embeddingResult as any).embedding || (Array.isArray(embeddingResult) ? (embeddingResult as any)[0].embedding : []);

    // 2. Save to Firestore
    await db.collection('knowledge_chunks').add({
        content,
        source,
        metadata,
        embedding: FieldValue.vector(embedding),
        createdAt: FieldValue.serverTimestamp()
    });
}
