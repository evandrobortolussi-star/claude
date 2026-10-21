import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { assertValidTransactionRefs, transactionsRef } from '@/lib/firestore/transactions';
import type { ExistingMovementRef } from '@/lib/import/matching';
import type {
  ExpenseScope,
  ImportStagedTransactionDoc,
  StagedStatus,
  StatementFormat,
  TransactionDoc,
  WithId,
} from '@/types/firestore';

function batchesRef(householdId: string) {
  return getAdminDb().collection(`households/${householdId}/importBatches`);
}

function stagedRef(householdId: string) {
  return getAdminDb().collection(`households/${householdId}/importStagedTransactions`);
}

export type ImportBatchInput = {
  sourceFormat: StatementFormat;
  fileName: string;
  accountId: string | null;
  cardId: string | null;
  totalRows: number;
};

export async function createImportBatch(householdId: string, createdBy: string, input: ImportBatchInput): Promise<string> {
  const ref = batchesRef(householdId).doc();
  await ref.set({
    householdId,
    sourceFormat: input.sourceFormat,
    fileName: input.fileName,
    accountId: input.accountId,
    cardId: input.cardId,
    totalRows: input.totalRows,
    createdBy,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

// Duplicate-detection pool: recent real transactions on this account/card
// plus any still-pending staged rows from earlier imports — mirrors the
// window the old SQL query used (occurred_on between minDate and maxDate).
// Queries range only on occurredOn (a single field) and filters the
// account/card match and staged status in memory, so no composite index is
// ever required — the result set for a multi-day window is always small.
export async function getDuplicateCheckPool(
  householdId: string,
  destination: { accountId?: string; cardId?: string },
  minDate: string,
  maxDate: string,
): Promise<ExistingMovementRef[]> {
  const matchesDestination = (row: { accountId: string | null; cardId: string | null }) =>
    destination.accountId ? row.accountId === destination.accountId : row.cardId === destination.cardId;

  const [transactionsSnapshot, stagedSnapshot] = await Promise.all([
    transactionsRef(householdId).where('occurredOn', '>=', minDate).where('occurredOn', '<=', maxDate).get(),
    stagedRef(householdId).where('status', 'in', ['PENDING', 'SUGGESTED']).get(),
  ]);

  const fromTransactions = transactionsSnapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as TransactionDoc) }))
    .filter((t) => t.deletedAt === null && matchesDestination(t))
    .map((t) => ({ id: t.id, occurredOn: t.occurredOn, amountCents: t.amountCents, externalId: t.externalId }));

  const fromStaged = stagedSnapshot.docs
    .map((doc) => doc.data() as ImportStagedTransactionDoc)
    .filter(matchesDestination)
    .map((data) => ({ occurredOn: data.occurredOn, amountCents: data.amountCents, externalId: data.externalId }));

  return [...fromTransactions, ...fromStaged];
}

export type StagedRowToCreate = Omit<ImportStagedTransactionDoc, 'householdId' | 'createdAt' | 'updatedAt'>;

export async function bulkCreateStagedTransactions(householdId: string, rows: StagedRowToCreate[]): Promise<void> {
  const batch = getAdminDb().batch();
  for (const row of rows) {
    const ref = stagedRef(householdId).doc();
    batch.set(ref, {
      householdId,
      ...row,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function listPendingStaged(householdId: string): Promise<WithId<ImportStagedTransactionDoc>[]> {
  const snapshot = await stagedRef(householdId).where('status', 'in', ['PENDING', 'SUGGESTED']).get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as ImportStagedTransactionDoc) }))
    .sort((a, b) => (a.occurredOn < b.occurredOn ? 1 : -1));
}

export async function countPendingStaged(householdId: string): Promise<number> {
  const snapshot = await stagedRef(householdId).where('status', 'in', ['PENDING', 'SUGGESTED']).count().get();
  return snapshot.data().count;
}

export async function getStagedTransaction(householdId: string, id: string): Promise<WithId<ImportStagedTransactionDoc> | null> {
  const snapshot = await stagedRef(householdId).doc(id).get();
  if (!snapshot.exists) return null;
  return { id: snapshot.id, ...(snapshot.data() as ImportStagedTransactionDoc) };
}

export async function getTransactionsByIds(
  householdId: string,
  ids: string[],
): Promise<Map<string, { description: string; occurredOn: string; amountCents: number }>> {
  const result = new Map<string, { description: string; occurredOn: string; amountCents: number }>();
  if (ids.length === 0) return result;

  const refs = ids.map((id) => transactionsRef(householdId).doc(id));
  const snapshots = await getAdminDb().getAll(...refs);
  for (const snapshot of snapshots) {
    if (!snapshot.exists) continue;
    const data = snapshot.data() as { description: string; occurredOn: string; amountCents: number };
    result.set(snapshot.id, { description: data.description, occurredOn: data.occurredOn, amountCents: data.amountCents });
  }
  return result;
}

// Confirming a staged row creates the real transaction (never touching any
// other transaction) and marks the staged row CONFIRMED — it keeps its own
// row either way, it's never deleted (same spirit as every other soft
// delete in this app).
export async function confirmStagedTransaction(
  householdId: string,
  createdBy: string,
  stagedId: string,
  categoryId: string,
  scope: ExpenseScope,
): Promise<void> {
  const staged = await getStagedTransaction(householdId, stagedId);
  if (!staged) throw new Error('Movimentação não encontrada.');
  if (staged.status === 'CONFIRMED') throw new Error('Esta movimentação já foi confirmada.');

  const common = {
    type: staged.type,
    description: staged.description,
    notes: null,
    categoryId,
    accountId: staged.accountId,
    cardId: staged.cardId,
    scope,
  };
  await assertValidTransactionRefs(householdId, common);

  const transactionRef = transactionsRef(householdId).doc();
  await transactionRef.set({
    householdId,
    type: common.type,
    amountCents: staged.amountCents,
    occurredOn: staged.occurredOn,
    description: common.description,
    notes: common.notes,
    categoryId: common.categoryId,
    accountId: common.accountId,
    cardId: common.cardId,
    scope: common.scope,
    recurrenceId: null,
    installmentGroupId: null,
    installmentNumber: null,
    installmentTotal: null,
    importBatchId: staged.importBatchId,
    externalId: staged.externalId,
    createdBy,
    deletedAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  await stagedRef(householdId)
    .doc(stagedId)
    .update({
      status: 'CONFIRMED' satisfies StagedStatus,
      categoryId,
      scope,
      resultingTransactionId: transactionRef.id,
      updatedAt: FieldValue.serverTimestamp(),
    });
}

export async function ignoreStagedTransaction(householdId: string, id: string): Promise<void> {
  await stagedRef(householdId)
    .doc(id)
    .update({ status: 'IGNORED' satisfies StagedStatus, updatedAt: FieldValue.serverTimestamp() });
}
