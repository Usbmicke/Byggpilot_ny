import { NextRequest, NextResponse } from 'next/server';

const GENKIT_API_HOST = process.env.GENKIT_API_HOST || 'http://localhost:4001';

async function proxyToGenkit(req: NextRequest) {
    const path = req.nextUrl.pathname.replace('/api/genkit', '');
    const targetUrl = `${GENKIT_API_HOST}/api${path}${req.nextUrl.search}`;

    console.log(`[Genkit Proxy] Forwarding ${req.method} request to ${targetUrl}`);

    try {
        const headers = new Headers(req.headers);
        headers.delete('host'); // Avoid host mismatch issues

        // Ensure Authorization header is passed
        const authHeader = req.headers.get('authorization');
        if (authHeader) {
            headers.set('Authorization', authHeader);
        }

        const body = req.method !== 'GET' ? await req.blob() : undefined;

        const response = await fetch(targetUrl, {
            method: req.method,
            headers,
            body,
            // @ts-ignore - duplex is needed for some node versions/fetch implementations with streaming but standard types forbid it
            duplex: 'half',
        });

        return new NextResponse(response.body, {
            status: response.status,
            headers: response.headers,
        });
    } catch (error) {
        console.error('[Genkit Proxy] Error:', error);
        return NextResponse.json({ error: 'Failed to connect to Genkit' }, { status: 502 });
    }
}

export const GET = proxyToGenkit;
export const POST = proxyToGenkit;
