
import { NextResponse } from 'next/server';
import { db } from '@/lib/dal/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'undefined';
        const hasServiceKey = !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY || !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

        console.log("--- DEBUG AUTH ---");
        console.log("Project ID:", projectId);
        console.log("Has Service Key:", hasServiceKey);

        const testDoc = await db.collection('users').limit(1).get();

        return NextResponse.json({
            success: true,
            projectId,
            hasServiceKey,
            docsFound: testDoc.size,
            message: "Connection Successful"
        });
    } catch (error: any) {
        console.error("DEBUG AUTH ERROR:", error);
        return NextResponse.json({
            success: false,
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            error: error.message,
            code: error.code
        }, { status: 500 });
    }
}
