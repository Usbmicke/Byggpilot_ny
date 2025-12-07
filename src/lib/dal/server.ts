import 'server-only';
import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
    let credential;

    // 1. Prioritize Service Account Key (Robust for Local/Vercel)
    // 1. Prioritize Service Account Key (Robust for Local/Vercel)
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (serviceAccountJson) {
        console.log("SEARCHING FOR CREDENTIALS: Found FIREBASE_SERVICE_ACCOUNT_KEY/JSON env var.");
        try {
            // Handle potentially escaped newlines in env vars
            const serviceAccount = JSON.parse(serviceAccountJson);
            credential = admin.credential.cert(serviceAccount);
            console.log("✅ Successfully parsed Service Account JSON.");
        } catch (e) {
            console.error("❌ Failed to parse Service Account JSON. Falling back to ADC.", e);
        }
    } else {
        console.warn("⚠️ No FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_SERVICE_ACCOUNT_JSON found in environment.");
    }

    // 2. Fallback to Application Default Credentials (ADC)
    if (!credential) {
        console.log("SEARCHING FOR CREDENTIALS: Attempting Application Default Credentials (ADC)...");
        try {
            credential = admin.credential.applicationDefault();
        } catch (e) {
            console.error("❌ Failed to initialize ADC:", e);
        }
    }

    admin.initializeApp({
        credential,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'byggpilot-v2',
    });
}

// Global Fix: Ignore "undefined" fields in Firestore calls (prevents crashes)
try {
    admin.firestore().settings({ ignoreUndefinedProperties: true });
} catch (e) {
    // Settings might be locked if already accessed, ignore.
}

export const auth = admin.auth();
export const db = admin.firestore();
