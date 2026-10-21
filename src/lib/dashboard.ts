import { getAdminDb } from '@/lib/firebase/admin';
import type { CreditCardDoc, ExpenseScope, LoanDoc, TransactionDoc } from '@/types/firestore';
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
  amountCents: number;
  occurredOn: string;
  description: string;
  scope: ExpenseScope;
  categoryId: string | null;
  accountId: string | null;
  cardId: string | null;
};

// Every query here ranges on occurredOn only (a single field — never needs a
// composite index) and applies scope/account/card/category filters in
// memory. A household's monthly transaction volume is small enough that
// this costs nothing in practice and sidesteps Firestore composite-index
// setup entirely.
function matchesFilters(t: DashboardTransaction, filters: DashboardFilters): boolean {
  if (filters.scope && t.scope !== filters.scope) return false;
  if (filters.accountId && t.accountId !== filters.accountId) return false;
  if (filters.cardId && t.cardId !== filters.cardId) return false;
  if (filters.categoryId && t.categoryId !== filters.categoryId) return false;
  return true;
}

function toDashboardTransaction(id: string, data: TransactionDoc): DashboardTransaction {
  return {
    id,
    type: data.type,
    amountCents: data.amountCents,
    occurredOn: data.occurredOn,
    description: data.description,
    scope: data.scope,
    categoryId: data.categoryId,
    accountId: data.accountId,
    cardId: data.cardId,
  };
}

export async function getMonthTransactions(
  householdId: string,
  start: Date,
  end: Date,
  filters: DashboardFilters,
): Promise<DashboardTransaction[]> {
  const snapshot = await getAdminDb()
    .collection(`households/${householdId}/transactions`)
    .where('occurredOn', '>=', toDateInputValue(start))
    .where('occurredOn', '<', toDateInputValue(end))
    .get();

  return snapshot.docs
    .map((doc) => {
      const data = doc.data() as TransactionDoc;
      return { transaction: toDashboardTransaction(doc.id, data), deletedAt: data.deletedAt };
    })
    .filter((t) => t.deletedAt === null)
    .map((t) => t.transaction)
    .filter((t) => matchesFilters(t, filters));
}

export function summarizeTotals(transactions: DashboardTransaction[]) {
  const income = transactions.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amountCents, 0);
  const expense = transactions.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amountCents, 0);
  return { income, expense, balance: income - expense };
}

export function summarizeByScope(transactions: DashboardTransaction[]): Record<ExpenseScope, number> {
  const result: Record<ExpenseScope, number> = { FAMILY: 0, SPOUSE_1: 0, SPOUSE_2: 0 };
  for (const t of transactions) {
    if (t.type === 'EXPENSE') result[t.scope] += t.amountCents;
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
    const key = t.categoryId ?? '__none__';
    const current = map.get(key) ?? {
      categoryId: t.categoryId,
      name: t.categoryId ? (categoryNameById.get(t.categoryId) ?? 'Categoria') : 'Sem categoria',
      totalCents: 0,
    };
    current.totalCents += t.amountCents;
    map.set(key, current);
  }
  return Array.from(map.values()).sort((a, b) => b.totalCents - a.totalCents);
}

export function topExpenses(transactions: DashboardTransaction[], limit = 5): DashboardTransaction[] {
  return transactions
    .filter((t) => t.type === 'EXPENSE')
    .sort((a, b) => b.amountCents - a.amountCents)
    .slice(0, limit);
}

export function countUncategorizedExpenses(transactions: DashboardTransaction[]): number {
  return transactions.filter((t) => t.type === 'EXPENSE' && !t.categoryId).length;
}

export type MonthlyPoint = { label: string; incomeCents: number; expenseCents: number };

export async function getMonthlyTrend(
  householdId: string,
  referenceDate: Date,
  monthsBack: number,
  filters: DashboardFilters,
): Promise<MonthlyPoint[]> {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - (monthsBack - 1), 1);
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);

  const snapshot = await getAdminDb()
    .collection(`households/${householdId}/transactions`)
    .where('occurredOn', '>=', toDateInputValue(start))
    .where('occurredOn', '<', toDateInputValue(end))
    .get();

  const rows = snapshot.docs
    .map((doc) => {
      const data = doc.data() as TransactionDoc;
      return { transaction: toDashboardTransaction(doc.id, data), deletedAt: data.deletedAt };
    })
    .filter((t) => t.deletedAt === null)
    .map((t) => t.transaction)
    .filter((t) => matchesFilters(t, filters));

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

  for (const t of rows) {
    const [y, m] = t.occurredOn.split('-').map(Number);
    const key = `${y}-${m - 1}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (t.type === 'INCOME') bucket.incomeCents += t.amountCents;
    else bucket.expenseCents += t.amountCents;
  }

  return Array.from(buckets.values());
}

export type MonthlyScopePoint = { label: string; FAMILY: number; SPOUSE_1: number; SPOUSE_2: number };

export async function getMonthlyTrendByScope(
  householdId: string,
  referenceDate: Date,
  monthsBack: number,
): Promise<MonthlyScopePoint[]> {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - (monthsBack - 1), 1);
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);

  const snapshot = await getAdminDb()
    .collection(`households/${householdId}/transactions`)
    .where('occurredOn', '>=', toDateInputValue(start))
    .where('occurredOn', '<', toDateInputValue(end))
    .get();

  const rows = snapshot.docs
    .map((doc) => doc.data() as TransactionDoc)
    .filter((t) => t.deletedAt === null && t.type === 'EXPENSE');

  const buckets = new Map<string, MonthlyScopePoint>();
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - (monthsBack - 1 - i), 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    buckets.set(key, {
      label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      FAMILY: 0,
      SPOUSE_1: 0,
      SPOUSE_2: 0,
    });
  }

  for (const t of rows) {
    const [y, m] = t.occurredOn.split('-').map(Number);
    const key = `${y}-${m - 1}`;
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket[t.scope] += t.amountCents;
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

export async function getUpcomingDueDates(householdId: string): Promise<DueSoonItem[]> {
  const today = new Date();
  const windowEnd = new Date(today);
  windowEnd.setDate(windowEnd.getDate() + DUE_SOON_WINDOW_DAYS);

  const db = getAdminDb();
  const [cardsSnapshot, loansSnapshot] = await Promise.all([
    db.collection(`households/${householdId}/creditCards`).where('archived', '==', false).get(),
    db.collection(`households/${householdId}/loans`).where('archived', '==', false).get(),
  ]);

  const cards = cardsSnapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as CreditCardDoc) }))
    .filter((c) => c.deletedAt === null);
  const loans = loansSnapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as LoanDoc) }))
    .filter((l) => l.deletedAt === null && l.outstandingBalanceCents > 0);

  const items: DueSoonItem[] = [];

  for (const card of cards) {
    const due = nextOccurrence(card.dueDay, today);
    if (due <= windowEnd) {
      items.push({ id: card.id, label: `Fatura · ${card.name}`, dueDate: toDateInputValue(due), amountCents: null, kind: 'card' });
    }
  }

  for (const loan of loans) {
    if (loan.dueDay == null) continue;
    const due = nextOccurrence(loan.dueDay, today);
    if (due <= windowEnd) {
      items.push({
        id: loan.id,
        label: `Parcela · ${loan.name}`,
        dueDate: toDateInputValue(due),
        amountCents: loan.installmentAmountCents,
        kind: 'loan',
      });
    }
  }

  return items.sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
}
