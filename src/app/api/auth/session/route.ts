import { auth } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { idToken } = await request.json();

    if (!idToken) {
        return NextResponse.json({ error: 'Missing ID token' }, { status: 400 });
    }

    // Set session expiration to 5 days
    const expiresIn = 60 * 60 * 24 * 5 * 1000;

    try {
        const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });

        cookies().set('session', sessionCookie, {
            maxAge: expiresIn,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            sameSite: 'lax',
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to create session cookie', error);
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
}
