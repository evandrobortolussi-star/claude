import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import type { AccountDoc, AccountType, WithId } from '@/types/firestore';

export type AccountInput = {
  name: string;
  type: AccountType;
  institution: string | null;
  openingBalanceCents: number;
};

function accountsRef(householdId: string) {
  return getAdminDb().collection(`households/${householdId}/accounts`);
}

export async function listActiveAccounts(householdId: string): Promise<WithId<AccountDoc>[]> {
  const snapshot = await accountsRef(householdId).where('archived', '==', false).where('deletedAt', '==', null).get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as AccountDoc) }))
    .sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
}

export async function getAccount(householdId: string, id: string): Promise<WithId<AccountDoc> | null> {
  const snapshot = await accountsRef(householdId).doc(id).get();
  if (!snapshot.exists) return null;
  return { id: snapshot.id, ...(snapshot.data() as AccountDoc) };
}

// Used by every other domain (transactions, transfers, card payments,
// investment/loan payments) to validate an account reference — the same
// check the Postgres validate_*_row() triggers used to make.
export async function isActiveAccount(householdId: string, id: string): Promise<boolean> {
  const snapshot = await accountsRef(householdId).doc(id).get();
  if (!snapshot.exists) return false;
  return (snapshot.data() as AccountDoc).deletedAt === null;
}

export async function createAccount(householdId: string, input: AccountInput): Promise<string> {
  const ref = accountsRef(householdId).doc();
  await ref.set({
    householdId,
    name: input.name,
    type: input.type,
    institution: input.institution,
    openingBalanceCents: input.openingBalanceCents,
    archived: false,
    deletedAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function updateAccount(householdId: string, id: string, input: AccountInput): Promise<void> {
  await accountsRef(householdId)
    .doc(id)
    .update({
      name: input.name,
      type: input.type,
      institution: input.institution,
      openingBalanceCents: input.openingBalanceCents,
      updatedAt: FieldValue.serverTimestamp(),
    });
}

export async function archiveAccount(householdId: string, id: string): Promise<void> {
  await accountsRef(householdId).doc(id).update({ archived: true, updatedAt: FieldValue.serverTimestamp() });
}
