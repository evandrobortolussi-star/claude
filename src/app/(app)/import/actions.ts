'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireCurrentUser } from '@/lib/session';
import { parseStatement } from '@/lib/import';
import { normalizeDescription } from '@/lib/normalize';
import { findBestRule, checkPossibleDuplicate, type ExistingMovementRef } from '@/lib/import/matching';
import { addDaysISO } from '@/lib/format';
import { getCategoryOptions } from '@/lib/categories';
import { getRulesForMatching, incrementMatchCounts } from '@/lib/firestore/classificationRules';
import { bulkCreateStagedTransactions, createImportBatch, getDuplicateCheckPool } from '@/lib/firestore/importBatches';
import type { TransactionType } from '@/types/firestore';

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

  const content = await file.text();
  const parsed = parseStatement(file.name, content);
  if (parsed.rows.length === 0) {
    throw new Error(parsed.errors[0] ?? 'Nenhuma movimentação encontrada no arquivo.');
  }

  const batchId = await createImportBatch(user.householdId, user.id, {
    sourceFormat: parsed.format,
    fileName: file.name,
    accountId: kind === 'account' ? destId : null,
    cardId: kind === 'card' ? destId : null,
    totalRows: parsed.rows.length,
  });

  const [activeRules, categories] = await Promise.all([
    getRulesForMatching(user.householdId),
    getCategoryOptions(),
  ]);
  const categoryKindById = new Map<string, TransactionType>(categories.map((c) => [c.id, c.kind]));

  const dates = parsed.rows.map((r) => r.occurredOn).sort();
  const minDate = addDaysISO(dates[0], -2);
  const maxDate = addDaysISO(dates[dates.length - 1], 2);

  const duplicatePool: ExistingMovementRef[] = await getDuplicateCheckPool(
    user.householdId,
    kind === 'account' ? { accountId: destId } : { cardId: destId },
    minDate,
    maxDate,
  );

  const usedRuleCounts = new Map<string, number>();

  const stagedRows = parsed.rows.map((row) => {
    const normalized = normalizeDescription(row.description);
    const rule = findBestRule(normalized, activeRules, row.type, categoryKindById);
    const duplicate = checkPossibleDuplicate(row, duplicatePool);

    duplicatePool.push({ occurredOn: row.occurredOn, amountCents: row.amountCents, externalId: row.externalId ?? null });

    if (rule) {
      usedRuleCounts.set(rule.id, (usedRuleCounts.get(rule.id) ?? 0) + 1);
    }

    return {
      importBatchId: batchId,
      accountId: kind === 'account' ? destId : null,
      cardId: kind === 'card' ? destId : null,
      occurredOn: row.occurredOn,
      description: row.description,
      normalizedDescription: normalized,
      amountCents: row.amountCents,
      type: row.type,
      externalId: row.externalId ?? null,
      categoryId: rule?.categoryId ?? null,
      scope: rule?.scope ?? 'FAMILY',
      status: (rule ? 'SUGGESTED' : 'PENDING') as 'SUGGESTED' | 'PENDING',
      suggestedCategoryId: rule?.categoryId ?? null,
      suggestedScope: rule?.scope ?? null,
      matchedRuleId: rule?.id ?? null,
      possibleDuplicate: duplicate.possible,
      duplicateOfTransactionId: duplicate.matchId,
      resultingTransactionId: null,
      createdBy: user.id,
    };
  });

  await bulkCreateStagedTransactions(user.householdId, stagedRows);
  await incrementMatchCounts(user.householdId, usedRuleCounts);

  revalidatePath('/import/review');
  redirect('/import/review');
}
