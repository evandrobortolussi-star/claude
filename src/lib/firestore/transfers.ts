import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { isActiveAccount } from '@/lib/firestore/accounts';
import type { TransferDoc, WithId } from '@/types/firestore';

function transfersRef(householdId: string) {
  return getAdminDb().collection(`households/${householdId}/transfers`);
}

export async function listTransfers(householdId: string): Promise<WithId<TransferDoc>[]> {
  const snapshot = await transfersRef(householdId).where('deletedAt', '==', null).get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as TransferDoc) }))
    .sort((a, b) => (a.occurredOn < b.occurredOn ? 1 : -1));
}

export type TransferInput = {
  fromAccountId: string;
  toAccountId: string;
  amountCents: number;
  occurredOn: string;
  notes: string | null;
};

// Mirrors validate_transfer_row(): both accounts must belong to this
// household and not be soft-deleted. A transfer never becomes an
// income/expense transaction — it only ever lives in this collection.
export async function createTransfer(householdId: string, createdBy: string, input: TransferInput): Promise<void> {
  if (!(await isActiveAccount(householdId, input.fromAccountId))) throw new Error('Conta de origem inválida.');
  if (!(await isActiveAccount(householdId, input.toAccountId))) throw new Error('Conta de destino inválida.');

  await transfersRef(householdId)
    .doc()
    .set({
      householdId,
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      amountCents: input.amountCents,
      occurredOn: input.occurredOn,
      notes: input.notes,
      createdBy,
      deletedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
}

export async function softDeleteTransfer(householdId: string, id: string): Promise<void> {
  await transfersRef(householdId)
    .doc(id)
    .update({ deletedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
}
