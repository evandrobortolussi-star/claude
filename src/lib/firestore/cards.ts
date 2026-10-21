import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { isActiveAccount } from '@/lib/firestore/accounts';
import type { CardPaymentDoc, CreditCardDoc, TransactionDoc, WithId } from '@/types/firestore';

export type CreditCardInput = {
  name: string;
  brand: string | null;
  closingDay: number;
  dueDay: number;
  limitCents: number | null;
};

function cardsRef(householdId: string) {
  return getAdminDb().collection(`households/${householdId}/creditCards`);
}

function cardPaymentsRef(householdId: string) {
  return getAdminDb().collection(`households/${householdId}/cardPayments`);
}

export async function listActiveCards(householdId: string): Promise<WithId<CreditCardDoc>[]> {
  const snapshot = await cardsRef(householdId).where('archived', '==', false).where('deletedAt', '==', null).get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as CreditCardDoc) }))
    .sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());
}

export async function getCard(householdId: string, id: string): Promise<WithId<CreditCardDoc> | null> {
  const snapshot = await cardsRef(householdId).doc(id).get();
  if (!snapshot.exists) return null;
  return { id: snapshot.id, ...(snapshot.data() as CreditCardDoc) };
}

export async function isActiveCard(householdId: string, id: string): Promise<boolean> {
  const snapshot = await cardsRef(householdId).doc(id).get();
  if (!snapshot.exists) return false;
  return (snapshot.data() as CreditCardDoc).deletedAt === null;
}

export async function createCard(householdId: string, input: CreditCardInput): Promise<string> {
  const ref = cardsRef(householdId).doc();
  await ref.set({
    householdId,
    name: input.name,
    brand: input.brand,
    closingDay: input.closingDay,
    dueDay: input.dueDay,
    limitCents: input.limitCents,
    archived: false,
    deletedAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function updateCard(householdId: string, id: string, input: CreditCardInput): Promise<void> {
  await cardsRef(householdId)
    .doc(id)
    .update({
      name: input.name,
      brand: input.brand,
      closingDay: input.closingDay,
      dueDay: input.dueDay,
      limitCents: input.limitCents,
      updatedAt: FieldValue.serverTimestamp(),
    });
}

export async function archiveCard(householdId: string, id: string): Promise<void> {
  await cardsRef(householdId).doc(id).update({ archived: true, updatedAt: FieldValue.serverTimestamp() });
}

export type CardPurchase = {
  id: string;
  description: string;
  amountCents: number;
  occurredOn: string;
  installmentNumber: number | null;
  installmentTotal: number | null;
};

export async function listCardPurchases(householdId: string, cardId: string): Promise<CardPurchase[]> {
  const snapshot = await getAdminDb()
    .collection(`households/${householdId}/transactions`)
    .where('cardId', '==', cardId)
    .where('deletedAt', '==', null)
    .get();
  return snapshot.docs
    .map((doc) => {
      const data = doc.data() as TransactionDoc;
      return {
        id: doc.id,
        description: data.description,
        amountCents: data.amountCents,
        occurredOn: data.occurredOn,
        installmentNumber: data.installmentNumber,
        installmentTotal: data.installmentTotal,
      };
    })
    .sort((a, b) => (a.occurredOn < b.occurredOn ? 1 : -1));
}

export async function listCardPayments(householdId: string, cardId: string): Promise<WithId<CardPaymentDoc>[]> {
  const snapshot = await cardPaymentsRef(householdId)
    .where('cardId', '==', cardId)
    .where('deletedAt', '==', null)
    .get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as CardPaymentDoc) }))
    .sort((a, b) => (a.occurredOn < b.occurredOn ? 1 : -1));
}

export type CardPaymentInput = {
  cardId: string;
  accountId: string;
  amountCents: number;
  occurredOn: string;
  invoiceMonth: string;
  notes: string | null;
};

// Mirrors validate_card_payment_row(): paying an invoice never creates a new
// expense (the purchase was already recorded when it happened), it just
// settles it from an account — so this only ever touches card_payments.
export async function createCardPayment(householdId: string, createdBy: string, input: CardPaymentInput): Promise<void> {
  if (!(await isActiveCard(householdId, input.cardId))) throw new Error('Cartão inválido.');
  if (!(await isActiveAccount(householdId, input.accountId))) throw new Error('Conta inválida.');

  await cardPaymentsRef(householdId)
    .doc()
    .set({
      householdId,
      cardId: input.cardId,
      accountId: input.accountId,
      amountCents: input.amountCents,
      occurredOn: input.occurredOn,
      invoiceMonth: input.invoiceMonth,
      notes: input.notes,
      createdBy,
      deletedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
}

export async function softDeleteCardPayment(householdId: string, id: string): Promise<void> {
  await cardPaymentsRef(householdId)
    .doc(id)
    .update({ deletedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
}
