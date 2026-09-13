'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCurrentUser } from '@/lib/session';
import { parseBRLToCents } from '@/lib/format';

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
  const supabase = createClient();

  const { error } = await supabase.from('credit_cards').insert({
    household_id: user.householdId,
    name: parsed.name,
    brand: parsed.brand || null,
    closing_day: parsed.closingDay,
    due_day: parsed.dueDay,
    limit_cents: parsed.limit ? parseBRLToCents(parsed.limit) : null,
  });

  if (error) throw new Error('Não foi possível criar o cartão.');

  revalidatePath('/cards');
  redirect('/cards');
}

export async function updateCard(id: string, formData: FormData) {
  await requireCurrentUser();
  const parsed = cardSchema.parse(Object.fromEntries(formData));
  const supabase = createClient();

  const { error } = await supabase
    .from('credit_cards')
    .update({
      name: parsed.name,
      brand: parsed.brand || null,
      closing_day: parsed.closingDay,
      due_day: parsed.dueDay,
      limit_cents: parsed.limit ? parseBRLToCents(parsed.limit) : null,
    })
    .eq('id', id);

  if (error) throw new Error('Não foi possível salvar o cartão.');

  revalidatePath('/cards');
  redirect('/cards');
}

export async function archiveCard(id: string) {
  await requireCurrentUser();
  const supabase = createClient();
  await supabase.from('credit_cards').update({ archived: true }).eq('id', id);
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
  const supabase = createClient();

  const { error } = await supabase.from('card_payments').insert({
    household_id: user.householdId,
    card_id: cardId,
    account_id: parsed.accountId,
    amount_cents: parseBRLToCents(parsed.amount),
    occurred_on: parsed.occurredOn,
    invoice_month: `${parsed.invoiceMonth}-01`,
    notes: parsed.notes || null,
  });

  if (error) throw new Error('Não foi possível registrar o pagamento da fatura.');

  revalidatePath(`/cards/${cardId}`);
}

export async function deleteCardPayment(cardId: string, paymentId: string) {
  await requireCurrentUser();
  const supabase = createClient();
  await supabase.from('card_payments').update({ deleted_at: new Date().toISOString() }).eq('id', paymentId);
  revalidatePath(`/cards/${cardId}`);
}
