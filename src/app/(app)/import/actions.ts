'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireCurrentUser } from '@/lib/session';
import { parseStatement } from '@/lib/import';
import { normalizeDescription } from '@/lib/normalize';
import { findBestRule, checkPossibleDuplicate, type ExistingMovementRef, type RuleForMatching } from '@/lib/import/matching';
import { addDaysISO } from '@/lib/format';
import type { TransactionType } from '@/types/database';

export async function importStatement(formData: FormData) {
  const user = await requireCurrentUser();

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) {
    throw new Error('Selecione um arquivo para importar.');
  }

  const destination = String(formData.get('destination') ?? '');
  const kind: 'account' | 'card' | null = destination.startsWith('account:')
    ? 'account'
    : destination.startsWith('card:')
      ? 'card'
      : null;
  const destId = destination.slice(destination.indexOf(':') + 1);
  if (!kind || !destId) {
    throw new Error('Selecione a conta ou cartão de destino.');
  }
  const accountColumn = kind === 'account' ? ('account_id' as const) : ('card_id' as const);

  const content = await file.text();
  const parsed = parseStatement(file.name, content);
  if (parsed.rows.length === 0) {
    throw new Error(parsed.errors[0] ?? 'Nenhuma movimentação encontrada no arquivo.');
  }

  const supabase = createClient();

  const { data: batch, error: batchError } = await supabase
    .from('import_batches')
    .insert({
      household_id: user.householdId,
      source_format: parsed.format,
      file_name: file.name,
      account_id: kind === 'account' ? destId : null,
      card_id: kind === 'card' ? destId : null,
      total_rows: parsed.rows.length,
    })
    .select('id')
    .single();

  if (batchError || !batch) {
    throw new Error('Não foi possível iniciar a importação.');
  }

  const [{ data: rules }, { data: categories }] = await Promise.all([
    supabase
      .from('classification_rules')
      .select('id, pattern, category_id, scope, match_count')
      .eq('household_id', user.householdId)
      .eq('active', true)
      .is('deleted_at', null),
    supabase.from('categories').select('id, kind'),
  ]);

  const categoryKindById = new Map<string, TransactionType>((categories ?? []).map((c) => [c.id, c.kind]));
  const activeRules: RuleForMatching[] = rules ?? [];
  const matchCountByRuleId = new Map((rules ?? []).map((r) => [r.id, r.match_count]));

  const dates = parsed.rows.map((r) => r.occurredOn).sort();
  const minDate = addDaysISO(dates[0], -2);
  const maxDate = addDaysISO(dates[dates.length - 1], 2);

  const [{ data: existingTransactions }, { data: existingStaged }] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, occurred_on, amount_cents, external_id')
      .eq('household_id', user.householdId)
      .eq(accountColumn, destId)
      .gte('occurred_on', minDate)
      .lte('occurred_on', maxDate)
      .is('deleted_at', null),
    supabase
      .from('import_staged_transactions')
      .select('occurred_on, amount_cents, external_id')
      .eq('household_id', user.householdId)
      .eq(accountColumn, destId)
      .in('status', ['PENDING', 'SUGGESTED']),
  ]);

  const duplicatePool: ExistingMovementRef[] = [...(existingTransactions ?? []), ...(existingStaged ?? [])];

  const usedRuleCounts = new Map<string, number>();

  const stagedRows = parsed.rows.map((row) => {
    const normalized = normalizeDescription(row.description);
    const rule = findBestRule(normalized, activeRules, row.type, categoryKindById);
    const duplicate = checkPossibleDuplicate(row, duplicatePool);

    duplicatePool.push({ occurred_on: row.occurredOn, amount_cents: row.amountCents, external_id: row.externalId ?? null });

    if (rule) {
      usedRuleCounts.set(rule.id, (usedRuleCounts.get(rule.id) ?? 0) + 1);
    }

    return {
      household_id: user.householdId,
      import_batch_id: batch.id,
      account_id: kind === 'account' ? destId : null,
      card_id: kind === 'card' ? destId : null,
      occurred_on: row.occurredOn,
      description: row.description,
      normalized_description: normalized,
      amount_cents: row.amountCents,
      type: row.type,
      external_id: row.externalId ?? null,
      category_id: rule?.category_id ?? null,
      scope: rule?.scope ?? 'FAMILY',
      status: (rule ? 'SUGGESTED' : 'PENDING') as 'SUGGESTED' | 'PENDING',
      suggested_category_id: rule?.category_id ?? null,
      suggested_scope: rule?.scope ?? null,
      matched_rule_id: rule?.id ?? null,
      possible_duplicate: duplicate.possible,
      duplicate_of_transaction_id: duplicate.matchId,
    };
  });

  const { error: stagedError } = await supabase.from('import_staged_transactions').insert(stagedRows);
  if (stagedError) {
    throw new Error('Não foi possível processar as movimentações do arquivo.');
  }

  for (const [ruleId, count] of usedRuleCounts) {
    const previousCount = matchCountByRuleId.get(ruleId) ?? 0;
    await supabase
      .from('classification_rules')
      .update({ match_count: previousCount + count })
      .eq('id', ruleId);
  }

  revalidatePath('/import/review');
  redirect('/import/review');
}
