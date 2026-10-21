import { FieldValue } from 'firebase-admin/firestore';
import type { DocumentReference } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { assertValidTransactionRefs, transactionsRef, type TransactionCommon } from '@/lib/firestore/transactions';
import { toDateInputValue } from '@/lib/format';
import type { RecurringTransactionDoc } from '@/types/firestore';

function recurringRef(householdId: string) {
  return getAdminDb().collection(`households/${householdId}/recurringTransactions`);
}

export async function createRecurringTransaction(
  householdId: string,
  createdBy: string,
  common: TransactionCommon,
  amountCents: number,
  dayOfMonth: number,
  startDate: string,
  endDate: string | null,
): Promise<void> {
  await assertValidTransactionRefs(householdId, common);
  await recurringRef(householdId)
    .doc()
    .set({
      householdId,
      type: common.type,
      amountCents,
      description: common.description,
      categoryId: common.categoryId,
      accountId: common.accountId,
      cardId: common.cardId,
      scope: common.scope,
      dayOfMonth,
      startDate,
      endDate,
      lastGeneratedOn: null,
      active: true,
      notes: common.notes,
      createdBy,
      deletedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
}

// Mirrors clamp_day_of_month(): the given day-of-month clamped to the last
// real day of monthStart's month (e.g. day 31 in February -> 28).
function clampDayOfMonth(monthStart: Date, dayOfMonth: number): Date {
  const lastDayOfMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  return new Date(monthStart.getFullYear(), monthStart.getMonth(), Math.min(dayOfMonth, lastDayOfMonth));
}

function monthStartOf(dateISO: string): Date {
  const [year, month] = dateISO.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

function addMonths(monthStart: Date, months: number): Date {
  return new Date(monthStart.getFullYear(), monthStart.getMonth() + months, 1);
}

/**
 * Mirrors generate_due_recurring_transactions(): materializes any occurrence
 * due up to today into `transactions`, capped at 24 iterations per template
 * so a stale/forgotten recurrence can never backlog unboundedly in one call.
 * A Firestore transaction per template (re-reading lastGeneratedOn inside
 * it) closes the exact double-generation race migration 0005 fixed via
 * Postgres' FOR UPDATE for the same two-tabs-open scenario.
 */
export async function generateDueRecurringTransactions(householdId: string): Promise<number> {
  const db = getAdminDb();
  const activeSnapshot = await recurringRef(householdId).where('active', '==', true).where('deletedAt', '==', null).get();

  const todayISO = toDateInputValue(new Date());
  let totalGenerated = 0;

  for (const doc of activeSnapshot.docs) {
    const ref = doc.ref;

    await db.runTransaction(async (tx) => {
      const snapshot = await tx.get(ref);
      if (!snapshot.exists) return;
      const rec = snapshot.data() as RecurringTransactionDoc;
      if (!rec.active || rec.deletedAt !== null) return;

      let cursorMonth = rec.lastGeneratedOn ? addMonths(monthStartOf(rec.lastGeneratedOn), 1) : monthStartOf(rec.startDate);
      let lastGeneratedOn = rec.lastGeneratedOn;
      const pending: { ref: DocumentReference; occurredOn: string }[] = [];

      for (let iterations = 0; iterations < 24; iterations++) {
        const nextDateISO = toDateInputValue(clampDayOfMonth(cursorMonth, rec.dayOfMonth));

        if (nextDateISO > todayISO) break;
        if (rec.endDate && nextDateISO > rec.endDate) break;

        if (nextDateISO >= rec.startDate) {
          pending.push({ ref: transactionsRef(householdId).doc(), occurredOn: nextDateISO });
        }
        lastGeneratedOn = nextDateISO;
        cursorMonth = addMonths(cursorMonth, 1);
      }

      for (const { ref: transactionRef, occurredOn } of pending) {
        tx.set(transactionRef, {
          householdId,
          type: rec.type,
          amountCents: rec.amountCents,
          occurredOn,
          description: rec.description,
          notes: rec.notes,
          categoryId: rec.categoryId,
          accountId: rec.accountId,
          cardId: rec.cardId,
          scope: rec.scope,
          recurrenceId: ref.id,
          installmentGroupId: null,
          installmentNumber: null,
          installmentTotal: null,
          importBatchId: null,
          externalId: null,
          createdBy: rec.createdBy,
          deletedAt: null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      if (lastGeneratedOn !== rec.lastGeneratedOn) {
        tx.update(ref, { lastGeneratedOn, updatedAt: FieldValue.serverTimestamp() });
      }

      totalGenerated += pending.length;
    });
  }

  return totalGenerated;
}
