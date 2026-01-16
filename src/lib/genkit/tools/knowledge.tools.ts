import 'server-only';
import { z } from 'genkit';
import { ai } from '@/lib/genkit-instance';
import { db } from '@/lib/dal/server';
import { indexKnowledgeChunk } from '@/lib/dal/vector.store';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge_source');
const MANIFEST_PATH = path.join(process.cwd(), 'knowledge_manifest.json');

// Interface for Manifest
interface Manifest {
    [filename: string]: {
        hash: string;
        lastUpdated: string;
    };
}

export const ingestKnowledgeTool = ai.defineTool(
    {
        name: 'ingestKnowledge',
        description: 'Scans the knowledge_source directory for new or changed text files. Indexes them into the Vector Database for RAG. ONLY processes changed files to save costs.',
        inputSchema: z.object({
            force: z.boolean().optional().describe("Set to true to force re-indexing of all files (Expensive!)."),
        }),
        outputSchema: z.object({
            success: z.boolean(),
            processedFiles: z.array(z.string()),
            skippedFiles: z.array(z.string()),
            message: z.string()
        }),
    },
    async (input) => {
        try {
            console.log(`📚 Starting Knowledge Ingestion (Force: ${input.force})`);

            // 1. Ensure Directory Exists
            try {
                await fs.access(KNOWLEDGE_DIR);
            } catch {
                return { success: false, processedFiles: [], skippedFiles: [], message: `Directory not found: ${KNOWLEDGE_DIR}` };
            }

            // 2. Load Manifest
            let manifest: Manifest = {};
            try {
                const manifestData = await fs.readFile(MANIFEST_PATH, 'utf-8');
                manifest = JSON.parse(manifestData);
            } catch (e) {
                console.log("No manifest found, creating new one.");
            }

            const files = await fs.readdir(KNOWLEDGE_DIR);
            const txtFiles = files.filter(f => f.endsWith('.txt') || f.endsWith('.md')); // Support TXT and MD

            const processed: string[] = [];
            const skipped: string[] = [];

            // 3. Process Files
            for (const file of txtFiles) {
                const filePath = path.join(KNOWLEDGE_DIR, file);
                const content = await fs.readFile(filePath, 'utf-8');

                // Calculate Hash
                const hash = crypto.createHash('md5').update(content).digest('hex');

                // Check Manifest
                if (!input.force && manifest[file] && manifest[file].hash === hash) {
                    // console.log(`⏩ Skipping ${file} (Unchanged)`);
                    skipped.push(file);
                    continue;
                }

                console.log(`📝 Indexing ${file}...`);

                // CHUNKING STRATEGY
                // Simple strategy: Split by double newline (paragraphs) or fixed size.
                // For legislation texts, paragraphs are often good boundaries.
                // Let's do a hybrid: Split by paragraph, but chunk if too small?
                // Simplest robust way: Split by Paragraphs (\n\n). 

                const chunks = content.split(/\n\s*\n/);
                let chunkCounter = 0;

                for (const chunk of chunks) {
                    if (chunk.trim().length < 50) continue; // Skip tiny chunks

                    // Enrich chunk with source filename
                    const enrichedSource = `${file} (Chunk ${chunkCounter++})`;

                    // Call Vector Store
                    // Note: We might want to batch this, but for now sequential is safer/easier to debug.
                    await indexKnowledgeChunk(chunk.trim(), enrichedSource, { filename: file });
                }

                // Update Manifest
                manifest[file] = {
                    hash: hash,
                    lastUpdated: new Date().toISOString()
                };
                processed.push(file);
            }

            // 4. Save Manifest
            await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

            return {
                success: true,
                processedFiles: processed,
                skippedFiles: skipped,
                message: `Ingestion Complete. Processed: ${processed.length}, Skipped: ${skipped.length}`
            };

        } catch (e: any) {
            console.error("Ingestion Failed:", e);
            return {
                success: false,
                processedFiles: [],
                skippedFiles: [],
                message: `Error: ${e.message}`
            };
        }
    }
);
