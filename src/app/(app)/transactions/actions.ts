'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireCurrentUser } from '@/lib/session';
import { parseBRLToCents } from '@/lib/format';
import * as transactionsDb from '@/lib/firestore/transactions';
import { createRecurringTransaction, generateDueRecurringTransactions } from '@/lib/firestore/recurringTransactions';

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

function commonFields(parsed: ParsedFields): transactionsDb.TransactionCommon {
  return {
    type: parsed.type,
    description: parsed.description,
    notes: parsed.notes || null,
    categoryId: parsed.categoryId || null,
    accountId: parsed.accountId || null,
    cardId: parsed.cardId || null,
    scope: parsed.scope,
  };
}

export async function createTransaction(formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = baseSchema.parse(Object.fromEntries(formData));
  const totalCents = parseBRLToCents(parsed.amount);
  if (totalCents <= 0) throw new Error('O valor precisa ser maior que zero.');

  if (parsed.repetition === 'recurring') {
    const dayOfMonth = Number(parsed.occurredOn.split('-')[2]);
    await createRecurringTransaction(
      user.householdId,
      user.id,
      commonFields(parsed),
      totalCents,
      dayOfMonth,
      parsed.occurredOn,
      parsed.endDate || null,
    );
    // Materialize the first (and any already-due) occurrence right away.
    await generateDueRecurringTransactions(user.householdId);
  } else if (parsed.repetition === 'installments' && parsed.installments && parsed.installments >= 2) {
    await transactionsDb.createInstallmentTransactions(
      user.householdId,
      user.id,
      commonFields(parsed),
      totalCents,
      parsed.occurredOn,
      parsed.installments,
    );
  } else {
    await transactionsDb.createSingleTransaction(user.householdId, user.id, {
      ...commonFields(parsed),
      amountCents: totalCents,
      occurredOn: parsed.occurredOn,
    });
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
  const user = await requireCurrentUser();
  const parsed = editSchema.parse(Object.fromEntries(formData));

  await transactionsDb.updateTransaction(user.householdId, id, {
    ...commonFields(parsed),
    amountCents: parseBRLToCents(parsed.amount),
    occurredOn: parsed.occurredOn,
  });

  revalidatePath('/transactions');
  revalidatePath('/dashboard');
  redirect('/transactions');
}

export async function deleteTransaction(id: string) {
  const user = await requireCurrentUser();
  await transactionsDb.softDeleteTransaction(user.householdId, id);
  revalidatePath('/transactions');
  revalidatePath('/dashboard');
}
