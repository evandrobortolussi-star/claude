'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireCurrentUser } from '@/lib/session';
import { parseBRLToCents } from '@/lib/format';
import * as cardsDb from '@/lib/firestore/cards';

const cardSchema = z.object({
  name: z.string().trim().min(1, 'Informe um nome.'),
  brand: z.string().trim().optional(),
  closingDay: z.coerce.number().int().min(1).max(31),
  dueDay: z.coerce.number().int().min(1).max(31),
  limit: z.string().optional(),
});

export async function createCard(formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = cardSchema.parse(Object.fromEntries(formData));

  await cardsDb.createCard(user.householdId, {
    name: parsed.name,
    brand: parsed.brand || null,
    closingDay: parsed.closingDay,
    dueDay: parsed.dueDay,
    limitCents: parsed.limit ? parseBRLToCents(parsed.limit) : null,
  });

  revalidatePath('/cards');
  redirect('/cards');
}

export async function updateCard(id: string, formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = cardSchema.parse(Object.fromEntries(formData));

  await cardsDb.updateCard(user.householdId, id, {
    name: parsed.name,
    brand: parsed.brand || null,
    closingDay: parsed.closingDay,
    dueDay: parsed.dueDay,
    limitCents: parsed.limit ? parseBRLToCents(parsed.limit) : null,
  });

  revalidatePath('/cards');
  redirect('/cards');
}

export async function archiveCard(id: string) {
  const user = await requireCurrentUser();
  await cardsDb.archiveCard(user.householdId, id);
  revalidatePath('/cards');
}

const paymentSchema = z.object({
  amount: z.string().min(1, 'Informe o valor.'),
  occurredOn: z.string().min(1, 'Informe a data.'),
  invoiceMonth: z.string().min(1, 'Informe o mês da fatura.'),
  accountId: z.string().min(1, 'Selecione a conta.'),
  notes: z.string().trim().optional(),
});

export async function createCardPayment(cardId: string, formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = paymentSchema.parse(Object.fromEntries(formData));

  await cardsDb.createCardPayment(user.householdId, user.id, {
    cardId,
    accountId: parsed.accountId,
    amountCents: parseBRLToCents(parsed.amount),
    occurredOn: parsed.occurredOn,
    invoiceMonth: `${parsed.invoiceMonth}-01`,
    notes: parsed.notes || null,
  });

  revalidatePath(`/cards/${cardId}`);
}

export async function deleteCardPayment(cardId: string, paymentId: string) {
  const user = await requireCurrentUser();
  await cardsDb.softDeleteCardPayment(user.householdId, paymentId);
  revalidatePath(`/cards/${cardId}`);
}
