import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import type { ProfileDoc } from '@/types/firestore';

export type CurrentUser = {
  id: string;
  email: string | undefined;
  householdId: string;
  fullName: string;
  avatarEmoji: string;
  spouseSlot: 1 | 2;
  role: 'OWNER' | 'MEMBER';
};

const SESSION_COOKIE = 'session';

async function readSessionUser(): Promise<{ uid: string; email?: string } | null> {
  const cookie = cookies().get(SESSION_COOKIE)?.value;
  if (!cookie) return null;

  try {
    // checkRevoked: true — the authoritative check (middleware only verifies
    // the cookie's signature/expiry at the Edge; this re-confirms against
    // Firebase Auth itself, catching a revoked/disabled account).
    const decoded = await getAdminAuth().verifySessionCookie(cookie, true);
    return { uid: decoded.uid, email: decoded.email };
  } catch {
    return null;
  }
}

/**
 * Fetches the current user's profile from `profiles/{uid}` — the household
 * id it returns comes from the database, never from anything the client
 * sent, so callers can trust it.
 */
export async function requireCurrentUser(): Promise<CurrentUser> {
  const sessionUser = await readSessionUser();
  if (!sessionUser) {
    redirect('/login');
  }

  const snapshot = await getAdminDb().doc(`profiles/${sessionUser.uid}`).get();

  if (!snapshot.exists) {
    // Auth user exists but sign-up's complete-signup step hasn't finished / failed.
    redirect('/login?error=profile_missing');
  }

  const profile = snapshot.data() as ProfileDoc;
  return {
    id: sessionUser.uid,
    email: sessionUser.email,
    householdId: profile.householdId,
    fullName: profile.fullName,
    avatarEmoji: profile.avatarEmoji,
    spouseSlot: profile.spouseSlot,
    role: profile.role,
  };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const sessionUser = await readSessionUser();
  if (!sessionUser) return null;

  const snapshot = await getAdminDb().doc(`profiles/${sessionUser.uid}`).get();
  if (!snapshot.exists) return null;

  const profile = snapshot.data() as ProfileDoc;
  return {
    id: sessionUser.uid,
    email: sessionUser.email,
    householdId: profile.householdId,
    fullName: profile.fullName,
    avatarEmoji: profile.avatarEmoji,
    spouseSlot: profile.spouseSlot,
    role: profile.role,
  };
}
