
import 'server-only';
import { db } from './src/lib/dal/server';
import { admin } from 'firebase-admin';

async function verifyConnection() {
    console.log("--- Firebase Connection Verification ---");
    console.log("Project ID:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
    console.log("Service Account Key Present:", !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY || !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

    try {
        console.log("Attempting to read 'users' collection...");
        const snapshot = await db.collection('users').limit(1).get();
        console.log("✅ Success! Connection working. Documents found:", snapshot.size);
    } catch (e: any) {
        console.error("❌ Connection Failed!");
        console.error("Code:", e.code);
        console.error("Message:", e.message);
        if (e.code === 7) {
            console.log("\nPossible Causes for PERMISSION_DENIED (7):");
            console.log("1. Wrong Project ID (Check .env).");
            console.log("2. ADC Credentials expired (Run 'gcloud auth application-default login').");
            console.log("3. Service Account missing roles (Needs 'Firebase Admin' or 'Firestore Admin').");
        }
    }
}

// verifyConnection();
// NOTE: I cannot run this easily with ts-node because of imports.
// I will instead create a route to run this diagnostic.
