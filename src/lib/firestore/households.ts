import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import type { HouseholdDoc, ProfileDoc, WithId } from '@/types/firestore';

export async function getHousehold(householdId: string): Promise<WithId<HouseholdDoc> | null> {
  const snapshot = await getAdminDb().doc(`households/${householdId}`).get();
  if (!snapshot.exists) return null;
  return { id: snapshot.id, ...(snapshot.data() as HouseholdDoc) };
}

// At most 2 members ever exist per household (one per spouse slot) — sorting
// in memory avoids needing a composite index for a two-row result.
export async function listHouseholdMembers(householdId: string): Promise<WithId<ProfileDoc>[]> {
  const snapshot = await getAdminDb().collection('profiles').where('householdId', '==', householdId).get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as ProfileDoc) }))
    .sort((a, b) => a.spouseSlot - b.spouseSlot);
}

export async function updateOwnProfile(
  uid: string,
  data: { fullName: string; avatarEmoji: string },
): Promise<void> {
  await getAdminDb()
    .doc(`profiles/${uid}`)
    .update({
      fullName: data.fullName,
      avatarEmoji: data.avatarEmoji,
      updatedAt: FieldValue.serverTimestamp(),
    });
}

/**
 * Only the household's OWNER may rename it — enforced here in server code
 * (reading the caller's own profile) since there is no RLS to lean on
 * anymore. Returns ok:false instead of throwing for a non-owner, mirroring
 * the old "0 rows affected" behavior from the Postgres RLS policy.
 */
export async function renameHousehold(
  uid: string,
  householdId: string,
  name: string,
): Promise<{ ok: boolean }> {
  const db = getAdminDb();
  const profileSnapshot = await db.doc(`profiles/${uid}`).get();
  const profile = profileSnapshot.data() as ProfileDoc | undefined;

  if (!profile || profile.householdId !== householdId || profile.role !== 'OWNER') {
    return { ok: false };
  }

  await db.doc(`households/${householdId}`).update({ name, updatedAt: FieldValue.serverTimestamp() });
  return { ok: true };
}
