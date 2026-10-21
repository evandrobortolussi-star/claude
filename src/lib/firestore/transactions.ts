import { randomUUID } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { isActiveAccount } from '@/lib/firestore/accounts';
import { isActiveCard } from '@/lib/firestore/cards';
import { addMonthsClamped } from '@/lib/format';
import type { CategoryDoc, ExpenseScope, TransactionDoc, TransactionType, WithId } from '@/types/firestore';

export function transactionsRef(householdId: string) {
  return getAdminDb().collection(`households/${householdId}/transactions`);
}

export type TransactionCommon = {
  type: TransactionType;
  description: string;
  notes: string | null;
  categoryId: string | null;
  accountId: string | null;
  cardId: string | null;
  scope: ExpenseScope;
};

// Mirrors validate_transaction_row(): category must exist and match the
// entry's income/expense kind; account/card, if given, must belong to this
// household and not be soft-deleted.
export async function assertValidTransactionRefs(householdId: string, input: TransactionCommon): Promise<void> {
  if (input.categoryId) {
    const categorySnapshot = await getAdminDb().doc(`categories/${input.categoryId}`).get();
    const category = categorySnapshot.data() as CategoryDoc | undefined;
    if (!category) throw new Error('Categoria inválida.');
    if (category.kind !== input.type) throw new Error('A categoria não corresponde ao tipo do lançamento.');
  }
  if (input.accountId && !(await isActiveAccount(householdId, input.accountId))) {
    throw new Error('Conta inválida.');
  }
  if (input.cardId && !(await isActiveCard(householdId, input.cardId))) {
    throw new Error('Cartão inválido.');
  }
}

export type ListTransactionsFilter = {
  startInclusive: string; // 'YYYY-MM-DD'
  endExclusive: string;
  categoryId?: string | 'none';
  scope?: ExpenseScope;
  type?: TransactionType;
};

export async function listTransactions(
  householdId: string,
  filter: ListTransactionsFilter,
): Promise<WithId<TransactionDoc>[]> {
  const snapshot = await transactionsRef(householdId)
    .where('occurredOn', '>=', filter.startInclusive)
    .where('occurredOn', '<', filter.endExclusive)
    .get();

  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as TransactionDoc) }))
    .filter((t) => t.deletedAt === null)
    .filter((t) =>
      filter.categoryId === 'none' ? t.categoryId === null : filter.categoryId ? t.categoryId === filter.categoryId : true,
    )
    .filter((t) => (filter.scope ? t.scope === filter.scope : true))
    .filter((t) => (filter.type ? t.type === filter.type : true))
    .sort((a, b) => (a.occurredOn < b.occurredOn ? 1 : -1));
}

export async function getTransaction(householdId: string, id: string): Promise<WithId<TransactionDoc> | null> {
  const snapshot = await transactionsRef(householdId).doc(id).get();
  if (!snapshot.exists) return null;
  return { id: snapshot.id, ...(snapshot.data() as TransactionDoc) };
}

export type CreateTransactionInput = TransactionCommon & {
  amountCents: number;
  occurredOn: string;
};

export async function createSingleTransaction(
  householdId: string,
  createdBy: string,
  input: CreateTransactionInput,
): Promise<void> {
  await assertValidTransactionRefs(householdId, input);
  await transactionsRef(householdId)
    .doc()
    .set({
      householdId,
      type: input.type,
      amountCents: input.amountCents,
      occurredOn: input.occurredOn,
      description: input.description,
      notes: input.notes,
      categoryId: input.categoryId,
      accountId: input.accountId,
      cardId: input.cardId,
      scope: input.scope,
      recurrenceId: null,
      installmentGroupId: null,
      installmentNumber: null,
      installmentTotal: null,
      importBatchId: null,
      externalId: null,
      createdBy,
      deletedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
}

export async function createInstallmentTransactions(
  householdId: string,
  createdBy: string,
  common: TransactionCommon,
  totalCents: number,
  startOccurredOn: string,
  installmentsCount: number,
): Promise<void> {
  await assertValidTransactionRefs(householdId, common);

  const base = Math.floor(totalCents / installmentsCount);
  const remainder = totalCents - base * installmentsCount;
  const groupId = randomUUID();

  const batch = getAdminDb().batch();
  for (let i = 0; i < installmentsCount; i++) {
    const ref = transactionsRef(householdId).doc();
    batch.set(ref, {
      householdId,
      type: common.type,
      amountCents: base + (i === installmentsCount - 1 ? remainder : 0),
      occurredOn: addMonthsClamped(startOccurredOn, i),
      description: common.description,
      notes: common.notes,
      categoryId: common.categoryId,
      accountId: common.accountId,
      cardId: common.cardId,
      scope: common.scope,
      recurrenceId: null,
      installmentGroupId: groupId,
      installmentNumber: i + 1,
      installmentTotal: installmentsCount,
      importBatchId: null,
      externalId: null,
      createdBy,
      deletedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function updateTransaction(householdId: string, id: string, input: CreateTransactionInput): Promise<void> {
  await assertValidTransactionRefs(householdId, input);
  await transactionsRef(householdId)
    .doc(id)
    .update({
      type: input.type,
      amountCents: input.amountCents,
      occurredOn: input.occurredOn,
      description: input.description,
      notes: input.notes,
      categoryId: input.categoryId,
      accountId: input.accountId,
      cardId: input.cardId,
      scope: input.scope,
      updatedAt: FieldValue.serverTimestamp(),
    });
}

export async function softDeleteTransaction(householdId: string, id: string): Promise<void> {
  await transactionsRef(householdId)
    .doc(id)
    .update({ deletedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
}
