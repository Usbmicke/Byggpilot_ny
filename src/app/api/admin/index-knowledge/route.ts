import { NextResponse } from 'next/server';
import { indexKnowledgeChunk } from '@/lib/dal/vector.store';
import fs from 'fs';
import path from 'path';

export async function GET() {
    console.log("📚 Starting Knowledge Indexing...");
    const knowledgeDir = path.join(process.cwd(), 'knowledge_source');

    // Safety check - ONLY FOR DEV/LOCAL
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
    }

    try {
        if (!fs.existsSync(knowledgeDir)) {
            return NextResponse.json({ error: 'Knowledge dir not found' }, { status: 404 });
        }

        const files = fs.readdirSync(knowledgeDir);
        let count = 0;
        let fileCount = 0;

        for (const file of files) {
            if (!file.toLowerCase().endsWith('.txt')) continue;

            fileCount++;
            const filePath = path.join(knowledgeDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');

            console.log(`Processing ${file}...`);

            // Improved Chunking: Split by paragraphs, then join up to 1500 chars
            // This keeps semantic context better than hard cutting at 1000.
            const paragraphs = content.split(/\n\s*\n/);
            let chunk = "";

            for (const p of paragraphs) {
                if ((chunk.length + p.length) > 2000) {
                    // Flush chunk
                    await indexKnowledgeChunk(chunk.trim(), file);
                    count++;
                    chunk = p;
                } else {
                    chunk += "\n\n" + p;
                }
            }
            if (chunk.trim().length > 0) {
                await indexKnowledgeChunk(chunk.trim(), file);
                count++;
            }
        }

        console.log(`✅ Indexing Complete. ${fileCount} files, ${count} chunks.`);
        return NextResponse.json({ success: true, files: fileCount, itemsIndexed: count });
    } catch (e: any) {
        console.error("Indexing Failed:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
