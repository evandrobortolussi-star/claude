'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCurrentUser } from '@/lib/session';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, ExpenseScope } from '@/types/database';

async function upsertClassificationRule(
  supabase: SupabaseClient<Database>,
  householdId: string,
  pattern: string,
  categoryId: string,
  scope: ExpenseScope,
) {
  if (!pattern) return;

  const { data: existing } = await supabase
    .from('classification_rules')
    .select('id, match_count')
    .eq('household_id', householdId)
    .eq('pattern', pattern)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('classification_rules')
      .update({ category_id: categoryId, scope, match_count: existing.match_count + 1, active: true })
      .eq('id', existing.id);
  } else {
    await supabase.from('classification_rules').insert({
      household_id: householdId,
      pattern,
      category_id: categoryId,
      scope,
    });
  }
}

const confirmSchema = z.object({
  categoryId: z.string().min(1, 'Selecione uma categoria.'),
  scope: z.enum(['FAMILY', 'SPOUSE_1', 'SPOUSE_2']),
});

export async function confirmStagedTransaction(stagedId: string, formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = confirmSchema.parse(Object.fromEntries(formData));
  const supabase = createClient();

  const { data: staged } = await supabase
    .from('import_staged_transactions')
    .select('*')
    .eq('id', stagedId)
    .eq('household_id', user.householdId)
    .single();

  if (!staged) throw new Error('Movimentação não encontrada.');
  if (staged.status === 'CONFIRMED') throw new Error('Esta movimentação já foi confirmada.');

  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .insert({
      household_id: user.householdId,
      type: staged.type,
      amount_cents: staged.amount_cents,
      occurred_on: staged.occurred_on,
      description: staged.description,
      category_id: parsed.categoryId,
      account_id: staged.account_id,
      card_id: staged.card_id,
      scope: parsed.scope,
      import_batch_id: staged.import_batch_id,
      external_id: staged.external_id,
    })
    .select('id')
    .single();

  if (txError || !transaction) {
    throw new Error('Não foi possível confirmar a movimentação.');
  }

  await supabase
    .from('import_staged_transactions')
    .update({
      status: 'CONFIRMED',
      category_id: parsed.categoryId,
      scope: parsed.scope,
      resulting_transaction_id: transaction.id,
    })
    .eq('id', stagedId);

  // Learn from this classification for future imports — never touches any
  // transaction that already exists.
  await upsertClassificationRule(supabase, user.householdId, staged.normalized_description, parsed.categoryId, parsed.scope);

  revalidatePath('/import/review');
  revalidatePath('/import');
  revalidatePath('/transactions');
  revalidatePath('/dashboard');
}

export async function ignoreStagedTransaction(stagedId: string) {
  const user = await requireCurrentUser();
  const supabase = createClient();
  await supabase
    .from('import_staged_transactions')
    .update({ status: 'IGNORED' })
    .eq('id', stagedId)
    .eq('household_id', user.householdId);

  revalidatePath('/import/review');
  revalidatePath('/import');
}
