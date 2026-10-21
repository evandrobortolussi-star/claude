import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { isActiveAccount } from '@/lib/firestore/accounts';
import type { LoanDoc, LoanKind, LoanPaymentDoc, WithId } from '@/types/firestore';

export type LoanInput = {
  kind: LoanKind;
  name: string;
  institution: string | null;
  contractedAmountCents: number;
  installmentAmountCents: number;
  installmentsTotal: number;
  interestRateMonthly: number | null;
  dueDay: number | null;
  contractedOn: string;
};

function loansRef(householdId: string) {
  return getAdminDb().collection(`households/${householdId}/loans`);
}

function loanPaymentsRef(householdId: string) {
  return getAdminDb().collection(`households/${householdId}/loanPayments`);
}

export async function listActiveLoans(householdId: string): Promise<WithId<LoanDoc>[]> {
  const snapshot = await loansRef(householdId).where('archived', '==', false).where('deletedAt', '==', null).get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as LoanDoc) }))
    .sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
}

export async function getLoan(householdId: string, id: string): Promise<WithId<LoanDoc> | null> {
  const snapshot = await loansRef(householdId).doc(id).get();
  if (!snapshot.exists) return null;
  return { id: snapshot.id, ...(snapshot.data() as LoanDoc) };
}

export async function createLoan(householdId: string, input: LoanInput): Promise<string> {
  const ref = loansRef(householdId).doc();
  await ref.set({
    householdId,
    kind: input.kind,
    name: input.name,
    institution: input.institution,
    contractedAmountCents: input.contractedAmountCents,
    outstandingBalanceCents: input.contractedAmountCents,
    installmentAmountCents: input.installmentAmountCents,
    installmentsTotal: input.installmentsTotal,
    installmentsPaid: 0,
    interestRateMonthly: input.interestRateMonthly,
    dueDay: input.dueDay,
    contractedOn: input.contractedOn,
    archived: false,
    deletedAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function archiveLoan(householdId: string, id: string): Promise<void> {
  await loansRef(householdId).doc(id).update({ archived: true, updatedAt: FieldValue.serverTimestamp() });
}

export async function listLoanPayments(householdId: string, loanId: string): Promise<WithId<LoanPaymentDoc>[]> {
  const snapshot = await loanPaymentsRef(householdId)
    .where('loanId', '==', loanId)
    .where('deletedAt', '==', null)
    .get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as LoanPaymentDoc) }))
    .sort((a, b) => (a.occurredOn < b.occurredOn ? 1 : -1));
}

export type LoanPaymentInput = {
  amountCents: number;
  occurredOn: string;
  accountId: string | null;
  notes: string | null;
};

// Mirrors apply_loan_payment() + validate_loan_payment_row(): recording a
// payment atomically reduces the loan's outstanding balance and bumps
// installmentsPaid. The Firestore transaction closes the same race a
// concurrent double-payment would otherwise create — the same guarantee the
// Postgres FOR UPDATE fix (migration 0005) added for recurring generation.
export async function createLoanPayment(
  householdId: string,
  createdBy: string,
  loanId: string,
  input: LoanPaymentInput,
): Promise<void> {
  if (input.accountId && !(await isActiveAccount(householdId, input.accountId))) {
    throw new Error('Conta inválida.');
  }

  const db = getAdminDb();
  const loanRef = loansRef(householdId).doc(loanId);
  const paymentRef = loanPaymentsRef(householdId).doc();

  await db.runTransaction(async (tx) => {
    const loanSnapshot = await tx.get(loanRef);
    if (!loanSnapshot.exists || (loanSnapshot.data() as LoanDoc).deletedAt !== null) {
      throw new Error('Empréstimo/financiamento inválido.');
    }
    const loan = loanSnapshot.data() as LoanDoc;

    tx.set(paymentRef, {
      householdId,
      loanId,
      amountCents: input.amountCents,
      occurredOn: input.occurredOn,
      accountId: input.accountId,
      notes: input.notes,
      createdBy,
      deletedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    tx.update(loanRef, {
      outstandingBalanceCents: Math.max(0, loan.outstandingBalanceCents - input.amountCents),
      installmentsPaid: loan.installmentsPaid + 1,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function softDeleteLoanPayment(householdId: string, loanId: string, paymentId: string): Promise<void> {
  const db = getAdminDb();
  const loanRef = loansRef(householdId).doc(loanId);
  const paymentRef = loanPaymentsRef(householdId).doc(paymentId);

  await db.runTransaction(async (tx) => {
    const [loanSnapshot, paymentSnapshot] = await tx.getAll(loanRef, paymentRef);
    if (!paymentSnapshot.exists || !loanSnapshot.exists) return;

    const payment = paymentSnapshot.data() as LoanPaymentDoc;
    if (payment.deletedAt !== null) return;
    const loan = loanSnapshot.data() as LoanDoc;

    tx.update(paymentRef, { deletedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    tx.update(loanRef, {
      outstandingBalanceCents: loan.outstandingBalanceCents + payment.amountCents,
      installmentsPaid: Math.max(0, loan.installmentsPaid - 1),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}
