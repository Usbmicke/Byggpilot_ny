import { NextRequest, NextResponse } from 'next/server';
import { JobRepo } from '@/lib/dal/job.repo';

/**
 * WORKER ENDPOINT
 * Triggers processing for a specific job.
 * Intended to be called immediately after Job creation (Fire & Forget).
 */
export async function POST(req: NextRequest) {
    const { jobId } = await req.json();
    if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });

    console.log(`👷 [Worker] Received Job: ${jobId}`);

    // DONT AWAIT - Fire and forget logic?
    // In Serverless (Vercel), we MUST await or the execution context dies.
    // BUT we want to return quickly to the caller (Chat).
    // Workaround for Vercel Hobby: We must process synchronously or use properly configured Background Functions.
    // Since we don't have Vercel Pro queues setup here, we will try to process "Fast" things synchronously,
    // OR we accept that this endpoint might time out if it takes > 10s.

    // Better Strategy for MVP without external Queue infrastructure:
    // 1. Chat creates Job (Pending)
    // 2. Chat returns "Job Started" to Client.
    // 3. Client (Frontend) sees "Pending" Job.
    // 4. Client calls this endpoint via `fetch` and KEEPS CONNECTION OPEN (Long Polling style) or just triggers it.

    // Let's implement the Processor Logic here.
    processJob(jobId).catch(err => console.error("Job Processing Crashed:", err));

    // Return immediately to acknowledge receipt? 
    // If we return, lambda freezes. We must await `processJob` in Vercel.
    // So this endpoint is actually "Run Job Synchronously but called via HTTP so Chat is decoupled".

    await processJob(jobId);

    return NextResponse.json({ success: true, message: 'Job Processed' });
}


async function processJob(jobId: string) {
    const job = await JobRepo.get(jobId);
    if (!job) return;
    if (job.status !== 'pending') return; // Already picked up

    await JobRepo.updateStatus(jobId, 'processing');
    console.log(`👷 [Worker] Processing ${job.type}...`);

    try {
        let result = null;

        // --- DISPATCHER ---
        if (job.type === 'generate_offer') {
            const { offerFlow } = await import('@/lib/genkit/flows/offer');
            // We need to construct the flow input from job.data
            // job.data should match OfferInputSchema
            result = await offerFlow(job.data);

            // Save result to DB if needed, or if flow returns just JSON, store it.
            // For OfferFlow, it usually returns JSON structure.
            // Ideally we also save it to OfferRepo here?
            // The OfferFlow usually just returns JSON. Let's start by just saving the JSON result.
        }
        else if (job.type === 'create_invoice') {
            // Future logic
        }

        await JobRepo.updateStatus(jobId, 'completed', result);
        console.log(`✅ [Worker] Job ${jobId} Completed.`);

    } catch (error: any) {
        console.error(`❌ [Worker] Job ${jobId} Failed:`, error);
        await JobRepo.updateStatus(jobId, 'failed', undefined, error.message);
    }
}
