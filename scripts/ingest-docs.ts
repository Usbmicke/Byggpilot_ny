
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config'; // Load env vars
// We need to import the server-side tools but context might be tricky in a script.
// To keep it simple, we will initialize a minimal Genkit instance HERE or try to reuse the lib.
// Reusing lib might fail due to Next.js constraints (server-only).
// SAFEST BET: Re-initialize Genkit locally for this script.

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// CONFIG
const SOURCE_DIR = path.join(__dirname, '../knowledge_source');
const BATCH_SIZE = 50;
const EMBEDDING_MODEL = 'googleai/text-embedding-004';

// Initialize Firebase Admin (Standalone)
if (getApps().length === 0) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
        : require('../service-account.json'); // Fallback to file if env var missing

    initializeApp({
        credential: cert(serviceAccount)
    });
}

const db = getFirestore();

// Initialize Genkit (Standalone)
const ai = genkit({
    plugins: [googleAI()],
});

async function ingestDocs() {
    console.log(`📂 Reading from: ${SOURCE_DIR}`);

    if (!fs.existsSync(SOURCE_DIR)) {
        console.error(`❌ Source directory not found: ${SOURCE_DIR}`);
        console.log("👉 Please create 'knowledge_source' folder in project root and put .txt files there.");
        return;
    }

    const files = fs.readdirSync(SOURCE_DIR).filter(f => f.endsWith('.txt'));
    console.log(`Found ${files.length} files.`);

    for (const file of files) {
        console.log(`\nProcessing ${file}...`);
        const filePath = path.join(SOURCE_DIR, file);
        const text = fs.readFileSync(filePath, 'utf-8');

        // Simple Chunking Strategy: Split by double newline (Paragraphs)
        // Then filtering small chunks.
        const chunks = text.split(/\n\s*\n/).map(c => c.trim()).filter(c => c.length > 50);

        console.log(`-> Split into ${chunks.length} chunks.`);

        for (let i = 0; i < chunks.length; i++) {
            const content = chunks[i];
            const source = `${file} (Part ${i + 1})`;

            try {
                // 1. Generate Embedding
                const embeddingResult = await ai.embed({
                    embedder: EMBEDDING_MODEL,
                    content: content
                });

                // Handle different return shapes (Genkit versions vary)
                const embedding = (embeddingResult as any).embedding || (Array.isArray(embeddingResult) ? (embeddingResult as any)[0].embedding : []);

                // 2. Save to Firestore
                await db.collection('knowledge_chunks').add({
                    content,
                    source,
                    metadata: { originalFile: file },
                    embedding: FieldValue.vector(embedding),
                    createdAt: FieldValue.serverTimestamp()
                });

                process.stdout.write('.'); // Progress dot
            } catch (e: any) {
                console.error(`\n❌ Failed chunk ${i}:`, e.message);
            }
        }
    }
    console.log("\n✅ Ingestion Complete!");
    console.log("Don't forget to create the Firestore Vector Index if you haven't already.");
}

// Run
ingestDocs().catch(console.error);
