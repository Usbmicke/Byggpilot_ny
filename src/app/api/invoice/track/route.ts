import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/dal/server';
import { Timestamp } from 'firebase-admin/firestore';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const invoiceId = searchParams.get('id');

    // 1. Transparent 1x1 Pixel
    const pixel = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64'
    );

    if (invoiceId) {
        console.log(`👁️ Invoice Viewed: ${invoiceId}`);
        try {
            // 2. Update Firestore
            // Note: In a real app, we should check if it's already viewed to avoid spamming "viewedAt"
            const invocieRef = db.collection('invoices').doc(invoiceId);

            // Check if exists first to be safe, or just merge
            // We use 'invoices' collection. Ensure this matches where we save invoices.
            // If we don't have a dedicated 'invoices' collection yet (status was on project?), we might need to verify DAL.
            // Assumption: We are starting to save Invoice Documents now.

            await invocieRef.set({
                status: 'viewed',
                viewedAt: Timestamp.now()
            }, { merge: true });

        } catch (error) {
            console.error("Tracking Error", error);
        }
    }

    // 3. Return Image Response
    return new NextResponse(pixel, {
        headers: {
            'Content-Type': 'image/gif',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Surrogate-Control': 'no-store'
        },
    });
}
