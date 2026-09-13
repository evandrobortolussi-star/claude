import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, ExpenseScope } from '@/types/database';
import { toDateInputValue } from '@/lib/format';

export type DashboardFilters = {
  scope?: ExpenseScope;
  accountId?: string;
  cardId?: string;
  categoryId?: string;
};

export type DashboardTransaction = {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  amount_cents: number;
  occurred_on: string;
  description: string;
  scope: ExpenseScope;
  category_id: string | null;
};

function applyFilters<T>(query: T, filters: DashboardFilters): T {
  // Each .eq() call returns the same builder type, so this narrow cast is
  // safe — it only exists because the calls are conditional.
  let q = query as unknown as {
    eq: (column: string, value: string) => typeof q;
  };
  if (filters.scope) q = q.eq('scope', filters.scope);
  if (filters.accountId) q = q.eq('account_id', filters.accountId);
  if (filters.cardId) q = q.eq('card_id', filters.cardId);
  if (filters.categoryId) q = q.eq('category_id', filters.categoryId);
  return q as unknown as T;
}

export async function getMonthTransactions(
  supabase: SupabaseClient<Database>,
  householdId: string,
  start: Date,
  end: Date,
  filters: DashboardFilters,
): Promise<DashboardTransaction[]> {
  const query = supabase
    .from('transactions')
    .select('id, type, amount_cents, occurred_on, description, scope, category_id')
    .eq('household_id', householdId)
    .gte('occurred_on', toDateInputValue(start))
    .lt('occurred_on', toDateInputValue(end))
    .is('deleted_at', null);

  const { data } = await applyFilters(query, filters);
  return data ?? [];
}

export function summarizeTotals(transactions: DashboardTransaction[]) {
  const income = transactions.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount_cents, 0);
  const expense = transactions.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount_cents, 0);
  return { income, expense, balance: income - expense };
}

export function summarizeByScope(transactions: DashboardTransaction[]): Record<ExpenseScope, number> {
  const result: Record<ExpenseScope, number> = { FAMILY: 0, SPOUSE_1: 0, SPOUSE_2: 0 };
  for (const t of transactions) {
    if (t.type === 'EXPENSE') result[t.scope] += t.amount_cents;
  }
  return result;
}

export type CategoryBreakdownItem = { categoryId: string | null; name: string; totalCents: number };

export function summarizeByCategory(
  transactions: DashboardTransaction[],
  categoryNameById: Map<string, string>,
): CategoryBreakdownItem[] {
  const map = new Map<string, CategoryBreakdownItem>();
  for (const t of transactions) {
    if (t.type !== 'EXPENSE') continue;
    const key = t.category_id ?? '__none__';
    const current = map.get(key) ?? {
      categoryId: t.category_id,
      name: t.category_id ? (categoryNameById.get(t.category_id) ?? 'Categoria') : 'Sem categoria',
      totalCents: 0,
    };
    current.totalCents += t.amount_cents;
    map.set(key, current);
  }
  return Array.from(map.values()).sort((a, b) => b.totalCents - a.totalCents);
}

export function topExpenses(transactions: DashboardTransaction[], limit = 5): DashboardTransaction[] {
  return transactions
    .filter((t) => t.type === 'EXPENSE')
    .sort((a, b) => b.amount_cents - a.amount_cents)
    .slice(0, limit);
}

export function countUncategorizedExpenses(transactions: DashboardTransaction[]): number {
  return transactions.filter((t) => t.type === 'EXPENSE' && !t.category_id).length;
}

export type MonthlyPoint = { label: string; incomeCents: number; expenseCents: number };

export async function getMonthlyTrend(
  supabase: SupabaseClient<Database>,
  householdId: string,
  referenceDate: Date,
  monthsBack: number,
  filters: DashboardFilters,
): Promise<MonthlyPoint[]> {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - (monthsBack - 1), 1);
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);

  const query = supabase
    .from('transactions')
    .select('type, amount_cents, occurred_on')
    .eq('household_id', householdId)
    .gte('occurred_on', toDateInputValue(start))
    .lt('occurred_on', toDateInputValue(end))
    .is('deleted_at', null);

  const { data } = await applyFilters(query, filters);

  const buckets = new Map<string, MonthlyPoint>();
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - (monthsBack - 1 - i), 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    buckets.set(key, {
      label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      incomeCents: 0,
      expenseCents: 0,
    });
  }

  for (const t of data ?? []) {
    const [y, m] = t.occurred_on.split('-').map(Number);
    const key = `${y}-${m - 1}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (t.type === 'INCOME') bucket.incomeCents += t.amount_cents;
    else bucket.expenseCents += t.amount_cents;
  }

  return Array.from(buckets.values());
}

export type DueSoonItem = { id: string; label: string; dueDate: string; amountCents: number | null; kind: 'card' | 'loan' };

function clampedDate(year: number, monthIndex: number, day: number): Date {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(day, lastDay));
}

function nextOccurrence(dueDay: number, today: Date): Date {
  const candidate = clampedDate(today.getFullYear(), today.getMonth(), dueDay);
  candidate.setHours(0, 0, 0, 0);
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (candidate >= todayMidnight) return candidate;
  return clampedDate(today.getFullYear(), today.getMonth() + 1, dueDay);
}

const DUE_SOON_WINDOW_DAYS = 7;

export async function getUpcomingDueDates(
  supabase: SupabaseClient<Database>,
  householdId: string,
): Promise<DueSoonItem[]> {
  const today = new Date();
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + DUE_SOON_WINDOW_DAYS);

  const [{ data: cards }, { data: loans }] = await Promise.all([
    supabase
      .from('credit_cards')
      .select('id, name, due_day')
      .eq('household_id', householdId)
      .eq('archived', false)
      .is('deleted_at', null),
    supabase
      .from('loans')
      .select('id, name, due_day, installment_amount_cents, outstanding_balance_cents')
      .eq('household_id', householdId)
      .eq('archived', false)
      .is('deleted_at', null)
      .gt('outstanding_balance_cents', 0),
  ]);

  const items: DueSoonItem[] = [];

  for (const card of cards ?? []) {
    const due = nextOccurrence(card.due_day, today);
    if (due <= windowEnd) {
      items.push({ id: card.id, label: `Fatura · ${card.name}`, dueDate: toDateInputValue(due), amountCents: null, kind: 'card' });
    }
  }

  for (const loan of loans ?? []) {
    if (loan.due_day == null) continue;
    const due = nextOccurrence(loan.due_day, today);
    if (due <= windowEnd) {
      items.push({
        id: loan.id,
        label: `Parcela · ${loan.name}`,
        dueDate: toDateInputValue(due),
        amountCents: loan.installment_amount_cents,
        kind: 'loan',
      });
    }
  }

  return items.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
}
