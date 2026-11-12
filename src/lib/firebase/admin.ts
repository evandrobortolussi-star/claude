import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Admin SDK is the ONLY thing that ever talks to Firestore in this app —
 * every table-equivalent collection denies client access in firestore.rules,
 * so authorization lives entirely in server code (Server Components/Actions
 * and the two Route Handlers), never in the frontend. This mirrors the
 * previous Supabase model, where the browser client only ever did auth and
 * every table read/write went through the server client + RLS.
 */
function getAdminApp(): App {
  const existing = getApps();
  if (existing.length > 0) {
    return existing[0];
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountJson) {
    let parsed: object;
    try {
      parsed = JSON.parse(serviceAccountJson);
    } catch (error) {
      console.error(
        'FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON — paste the full contents of the service account file, unedited.',
        error,
      );
      throw error;
    }
    return initializeApp({ credential: cert(parsed) });
  }

  // On Firebase App Hosting (and most Google Cloud runtimes) the attached
  // service account is picked up automatically via Application Default
  // Credentials — no explicit key needed.
  return initializeApp();
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

export function getAdminDb() {
  return getFirestore(getAdminApp());
}
