import 'server-only';
import { cookies } from 'next/headers';
import { auth, db } from '@/lib/firebase-admin';

export interface AuthenticatedUser {
    uid: string;
    email?: string;
    companyId?: string;
}

/**
 * Standardizes server-side authentication.
 * Verification Source: Strict HttpOnly Session Cookie.
 * Throws Error if unauthorized.
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;

    // DEV BYPASS
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true') {
        console.warn("⚠️ AUTH DISABLED: Using Mock User");
        return {
            uid: 'dev-user-123',
            email: 'dev@test.se',
        };
    }

    if (!sessionCookie) {
        throw new Error('Unauthorized: No session found. Please log in.');
    }

    try {
        const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);

        // Optional: Fetch user from DB to get companyId immediately if needed frequently
        // For now, let's keep it lean and just return UID/Email, repos can fetch profile.
        // Actually, checking companyId here is powerful for "Tenant isolation".

        return {
            uid: decodedClaims.uid,
            email: decodedClaims.email,
        };
    } catch (error) {
        throw new Error('Unauthorized: Invalid session.');
    }
}

/**
 * Enforces resource ownership.
 * Checks if the resource exists and belongs to the user (OR their company).
 * @param resourceId ID of the object (Project, Customer, etc)
 * @param collection Firestore collection name
 * @param user The authenticated user object
 * @param ownerField The field in the document that holds the Owner UID (default: 'ownerId')
 */
export async function checkOwnership(
    resourceId: string,
    collection: string,
    user: AuthenticatedUser,
    ownerField: string = 'ownerId'
) {
    const docRef = db.collection(collection).doc(resourceId);
    const doc = await docRef.get();

    if (!doc.exists) {
        // Security by obscurity: Don't reveal if it exists or not, just unauthorized
        // OR return null? Typically 404 is fine.
        throw new Error(`${collection} not found`);
    }

    const data = doc.data();

    // 1. Direct Ownership (Personal)
    if (data?.[ownerField] === user.uid) {
        return data;
    }

    // 2. Company Ownership (Team)
    // If we had companyId in the user object, we could check data.companyId === user.companyId
    // For now, we mainly use ownerId.

    throw new Error('Unauthorized: You do not own this resource.');
}
