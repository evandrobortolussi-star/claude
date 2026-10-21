import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { isActiveAccount } from '@/lib/firestore/accounts';
import type { InvestmentDoc, InvestmentMovementDoc, InvestmentMovementType, InvestmentType, WithId } from '@/types/firestore';

export type InvestmentInput = {
  name: string;
  type: InvestmentType;
  institution: string | null;
};

function investmentsRef(householdId: string) {
  return getAdminDb().collection(`households/${householdId}/investments`);
}

function movementsRef(householdId: string) {
  return getAdminDb().collection(`households/${householdId}/investmentMovements`);
}

export async function listActiveInvestments(householdId: string): Promise<WithId<InvestmentDoc>[]> {
  const snapshot = await investmentsRef(householdId).where('archived', '==', false).where('deletedAt', '==', null).get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as InvestmentDoc) }))
    .sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
}

export async function getInvestment(householdId: string, id: string): Promise<WithId<InvestmentDoc> | null> {
  const snapshot = await investmentsRef(householdId).doc(id).get();
  if (!snapshot.exists) return null;
  return { id: snapshot.id, ...(snapshot.data() as InvestmentDoc) };
}

export async function createInvestment(householdId: string, input: InvestmentInput): Promise<string> {
  const ref = investmentsRef(householdId).doc();
  await ref.set({
    householdId,
    name: input.name,
    type: input.type,
    institution: input.institution,
    linkedAccountId: null,
    archived: false,
    deletedAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function archiveInvestment(householdId: string, id: string): Promise<void> {
  await investmentsRef(householdId).doc(id).update({ archived: true, updatedAt: FieldValue.serverTimestamp() });
}

// Balance is always derived from movements, never cached — mirrors the
// Postgres design (investments has no balance column at all).
export async function listAllMovements(householdId: string): Promise<WithId<InvestmentMovementDoc>[]> {
  const snapshot = await movementsRef(householdId).where('deletedAt', '==', null).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as InvestmentMovementDoc) }));
}

export async function listMovements(householdId: string, investmentId: string): Promise<WithId<InvestmentMovementDoc>[]> {
  const snapshot = await movementsRef(householdId)
    .where('investmentId', '==', investmentId)
    .where('deletedAt', '==', null)
    .get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as InvestmentMovementDoc) }))
    .sort((a, b) => (a.occurredOn < b.occurredOn ? 1 : -1));
}

export function sumMovements(movements: Pick<InvestmentMovementDoc, 'type' | 'amountCents'>[]): number {
  return movements.reduce((sum, m) => sum + (m.type === 'CONTRIBUTION' ? m.amountCents : -m.amountCents), 0);
}

export type InvestmentMovementInput = {
  type: InvestmentMovementType;
  amountCents: number;
  occurredOn: string;
  accountId: string | null;
  notes: string | null;
};

// Mirrors validate_investment_movement_row(): the investment and, if given,
// the account must belong to this household and not be deleted.
export async function createInvestmentMovement(
  householdId: string,
  createdBy: string,
  investmentId: string,
  input: InvestmentMovementInput,
): Promise<void> {
  const investment = await getInvestment(householdId, investmentId);
  if (!investment || investment.deletedAt !== null) throw new Error('Investimento inválido.');
  if (input.accountId && !(await isActiveAccount(householdId, input.accountId))) {
    throw new Error('Conta inválida.');
  }

  await movementsRef(householdId)
    .doc()
    .set({
      householdId,
      investmentId,
      type: input.type,
      amountCents: input.amountCents,
      occurredOn: input.occurredOn,
      accountId: input.accountId,
      notes: input.notes,
      createdBy,
      deletedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
}

export async function softDeleteInvestmentMovement(householdId: string, id: string): Promise<void> {
  await movementsRef(householdId)
    .doc(id)
    .update({ deletedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
}
