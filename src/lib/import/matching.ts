import { daysBetweenISO } from '@/lib/format';
import type { ExpenseScope, TransactionType } from '@/types/database';
import type { ParsedStatementRow } from './types';

export type RuleForMatching = {
  id: string;
  pattern: string;
  category_id: string;
  scope: ExpenseScope;
};

/**
 * Finds the most specific active rule whose pattern matches this
 * description — plain substring test in both directions, filtered to
 * categories of the same income/expense kind. The longest matching pattern
 * wins (most specific). Never a black box: the pattern that matched is
 * always the one shown to the user as "suggested by rule X".
 */
export function findBestRule(
  normalizedDescription: string,
  rules: RuleForMatching[],
  type: TransactionType,
  categoryKindById: Map<string, TransactionType>,
): RuleForMatching | null {
  let best: RuleForMatching | null = null;
  for (const rule of rules) {
    if (categoryKindById.get(rule.category_id) !== type) continue;
    const matches =
      normalizedDescription.includes(rule.pattern) || rule.pattern.includes(normalizedDescription);
    if (!matches) continue;
    if (!best || rule.pattern.length > best.pattern.length) best = rule;
  }
  return best;
}

export type ExistingMovementRef = {
  id?: string;
  occurred_on: string;
  amount_cents: number;
  external_id: string | null;
};

const DUPLICATE_DATE_WINDOW_DAYS = 2;

/**
 * Only ever returns a flag + best-guess reference for a human to review —
 * never a decision to skip or delete anything.
 */
export function checkPossibleDuplicate(
  row: ParsedStatementRow,
  existing: ExistingMovementRef[],
): { possible: boolean; matchId: string | null } {
  if (row.externalId) {
    const exact = existing.find((e) => e.external_id && e.external_id === row.externalId);
    if (exact) return { possible: true, matchId: exact.id ?? null };
  }

  const approximate = existing.find(
    (e) =>
      e.amount_cents === row.amountCents &&
      Math.abs(daysBetweenISO(row.occurredOn, e.occurred_on)) <= DUPLICATE_DATE_WINDOW_DAYS,
  );
  if (approximate) return { possible: true, matchId: approximate.id ?? null };

  return { possible: false, matchId: null };
}
