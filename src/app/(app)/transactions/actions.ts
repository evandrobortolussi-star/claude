'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCurrentUser } from '@/lib/session';
import { parseBRLToCents, addMonthsClamped } from '@/lib/format';

const baseSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  amount: z.string().min(1, 'Informe o valor.'),
  description: z.string().trim().min(1, 'Informe uma descrição.'),
  occurredOn: z.string().min(1, 'Informe a data.'),
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
  cardId: z.string().optional(),
  scope: z.enum(['FAMILY', 'SPOUSE_1', 'SPOUSE_2']),
  notes: z.string().trim().optional(),
  repetition: z.enum(['single', 'installments', 'recurring']).default('single'),
  installments: z.coerce.number().int().min(2).max(60).optional(),
  endDate: z.string().optional(),
});

type ParsedFields = Pick<
  z.infer<typeof baseSchema>,
  'type' | 'description' | 'notes' | 'categoryId' | 'accountId' | 'cardId' | 'scope'
>;

function commonFields(parsed: ParsedFields) {
  return {
    type: parsed.type,
    description: parsed.description,
    notes: parsed.notes || null,
    category_id: parsed.categoryId || null,
    account_id: parsed.accountId || null,
    card_id: parsed.cardId || null,
    scope: parsed.scope,
  };
}

export async function createTransaction(formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = baseSchema.parse(Object.fromEntries(formData));
  const totalCents = parseBRLToCents(parsed.amount);
  if (totalCents <= 0) throw new Error('O valor precisa ser maior que zero.');

  const supabase = createClient();

  if (parsed.repetition === 'recurring') {
    const dayOfMonth = Number(parsed.occurredOn.split('-')[2]);
    const { error } = await supabase.from('recurring_transactions').insert({
      ...commonFields(parsed),
      household_id: user.householdId,
      amount_cents: totalCents,
      day_of_month: dayOfMonth,
      start_date: parsed.occurredOn,
      end_date: parsed.endDate || null,
    });
    if (error) throw new Error('Não foi possível criar a recorrência.');

    // Materialize the first (and any already-due) occurrence right away.
    await supabase.rpc('generate_due_recurring_transactions', { p_household_id: user.householdId });
  } else if (parsed.repetition === 'installments' && parsed.installments && parsed.installments >= 2) {
    const n = parsed.installments;
    const base = Math.floor(totalCents / n);
    const remainder = totalCents - base * n;
    const groupId = randomUUID();

    const rows = Array.from({ length: n }, (_, i) => ({
      ...commonFields(parsed),
      household_id: user.householdId,
      amount_cents: base + (i === n - 1 ? remainder : 0),
      occurred_on: addMonthsClamped(parsed.occurredOn, i),
      installment_group_id: groupId,
      installment_number: i + 1,
      installment_total: n,
    }));

    const { error } = await supabase.from('transactions').insert(rows);
    if (error) throw new Error('Não foi possível criar o parcelamento.');
  } else {
    const { error } = await supabase.from('transactions').insert({
      ...commonFields(parsed),
      household_id: user.householdId,
      amount_cents: totalCents,
      occurred_on: parsed.occurredOn,
    });
    if (error) throw new Error('Não foi possível criar o lançamento.');
  }

  revalidatePath('/transactions');
  revalidatePath('/dashboard');
  redirect('/transactions');
}

const editSchema = baseSchema.pick({
  type: true,
  amount: true,
  description: true,
  occurredOn: true,
  categoryId: true,
  accountId: true,
  cardId: true,
  scope: true,
  notes: true,
});

export async function updateTransaction(id: string, formData: FormData) {
  await requireCurrentUser();
  const parsed = editSchema.parse(Object.fromEntries(formData));
  const supabase = createClient();

  const { error } = await supabase
    .from('transactions')
    .update({
      ...commonFields(parsed),
      amount_cents: parseBRLToCents(parsed.amount),
      occurred_on: parsed.occurredOn,
    })
    .eq('id', id);

  if (error) throw new Error('Não foi possível salvar o lançamento.');

  revalidatePath('/transactions');
  revalidatePath('/dashboard');
  redirect('/transactions');
}

export async function deleteTransaction(id: string) {
  await requireCurrentUser();
  const supabase = createClient();
  await supabase.from('transactions').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  revalidatePath('/transactions');
  revalidatePath('/dashboard');
}
