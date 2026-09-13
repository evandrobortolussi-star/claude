import Link from 'next/link';
import { requireCurrentUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { getCategoryOptions } from '@/lib/categories';
import { formatCentsToBRL, formatDate } from '@/lib/format';
import {
  getMonthTransactions,
  getMonthlyTrend,
  getUpcomingDueDates,
  summarizeTotals,
  summarizeByScope,
  summarizeByCategory,
  topExpenses,
  countUncategorizedExpenses,
  type DashboardFilters as Filters,
} from '@/lib/dashboard';
import { Card, CardTitle } from '@/components/ui/Card';
import { CategoryDonutChart, categoryPalette } from '@/components/charts/CategoryDonutChart';
import { MonthlyEvolutionChart } from '@/components/charts/MonthlyEvolutionChart';
import { DashboardFilters } from './DashboardFilters';
import type { ExpenseScope } from '@/types/database';

const SCOPE_LABEL: Record<ExpenseScope, string> = {
  FAMILY: 'Casal',
  SPOUSE_1: 'Cônjuge 1',
  SPOUSE_2: 'Cônjuge 2',
};

function parseMonth(month?: string) {
  const now = new Date();
  const [year, m] = (month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    .split('-')
    .map(Number);
  return { year, month: m, start: new Date(year, m - 1, 1), end: new Date(year, m, 1) };
}

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function withMonth(month: string, extra: Record<string, string | undefined>) {
  const params = new URLSearchParams({ month });
  for (const [k, v] of Object.entries(extra)) if (v) params.set(k, v);
  return `/transactions?${params.toString()}`;
}

function dashboardHref(current: Record<string, string | undefined>, overrides: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...overrides })) {
    if (v) params.set(k, v);
  }
  return `/dashboard?${params.toString()}`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { month?: string; scope?: string; accountId?: string; cardId?: string; categoryId?: string };
}) {
  const user = await requireCurrentUser();
  const supabase = createClient();

  const { year, month, start, end } = parseMonth(searchParams.month);
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;

  const filters: Filters = {
    scope: (searchParams.scope as ExpenseScope) || undefined,
    accountId: searchParams.accountId || undefined,
    cardId: searchParams.cardId || undefined,
    categoryId: searchParams.categoryId || undefined,
  };

  const [categories, { data: accounts }, { data: cards }, transactions, trend, dueSoon] = await Promise.all([
    getCategoryOptions(supabase),
    supabase
      .from('accounts')
      .select('id, name')
      .eq('household_id', user.householdId)
      .eq('archived', false)
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('credit_cards')
      .select('id, name')
      .eq('household_id', user.householdId)
      .eq('archived', false)
      .is('deleted_at', null)
      .order('name'),
    getMonthTransactions(supabase, user.householdId, start, end, filters),
    getMonthlyTrend(supabase, user.householdId, start, 6, filters),
    getUpcomingDueDates(supabase, user.householdId),
  ]);

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const { income, expense, balance } = summarizeTotals(transactions);
  const byScope = summarizeByScope(transactions);
  const byCategory = summarizeByCategory(transactions, categoryNameById);
  const ranking = topExpenses(transactions, 5);
  const uncategorizedCount = countUncategorizedExpenses(transactions);
  const monthLabel = start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const hasAnyMovement = transactions.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Visão financeira</h1>
        <p className="text-sm text-slate-500">Como o dinheiro do casal se moveu neste mês.</p>
      </div>

      <div className="flex items-center justify-between">
        <Link href={dashboardHref(searchParams, { month: shiftMonth(year, month, -1) })} className="p-2 text-slate-400">
          ‹
        </Link>
        <p className="text-sm font-medium capitalize text-slate-900">{monthLabel}</p>
        <Link href={dashboardHref(searchParams, { month: shiftMonth(year, month, 1) })} className="p-2 text-slate-400">
          ›
        </Link>
      </div>

      <DashboardFilters
        accounts={accounts ?? []}
        cards={cards ?? []}
        categories={categories.filter((c) => c.kind === 'EXPENSE')}
      />

      {dueSoon.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardTitle className="mb-2 text-amber-700">Vencendo em breve</CardTitle>
          <ul className="space-y-1.5">
            {dueSoon.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="flex items-center justify-between text-sm text-amber-800">
                <span>{item.label}</span>
                <span className="font-medium">
                  {formatDate(item.dueDate)}
                  {item.amountCents != null ? ` · ${formatCentsToBRL(item.amountCents)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {uncategorizedCount > 0 && (
        <Link
          href={withMonth(monthKey, { categoryId: 'none' })}
          className="block rounded-2xl border border-dashed border-slate-300 bg-white p-3 text-center text-sm font-medium text-slate-600"
        >
          {uncategorizedCount} despesa{uncategorizedCount === 1 ? '' : 's'} sem categoria →
        </Link>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Card className="p-3 text-center">
          <p className="text-[11px] text-slate-500">Recebido</p>
          <p className="mt-1 text-sm font-semibold text-income">{formatCentsToBRL(income)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-[11px] text-slate-500">Gasto</p>
          <p className="mt-1 text-sm font-semibold text-expense">{formatCentsToBRL(expense)}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-[11px] text-slate-500">Saldo</p>
          <p className={`mt-1 text-sm font-semibold ${balance >= 0 ? 'text-income' : 'text-expense'}`}>
            {formatCentsToBRL(balance)}
          </p>
        </Card>
      </div>

      <Card>
        <CardTitle className="mb-3">Gastos por responsável</CardTitle>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(SCOPE_LABEL) as ExpenseScope[]).map((scope) => (
            <Link
              key={scope}
              href={dashboardHref(searchParams, { scope: searchParams.scope === scope ? undefined : scope })}
              className={`rounded-xl p-2.5 text-center ${searchParams.scope === scope ? 'bg-brand-50 ring-1 ring-brand-200' : 'bg-slate-50 hover:bg-slate-100'}`}
            >
              <p className="text-[11px] text-slate-500">{SCOPE_LABEL[scope]}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatCentsToBRL(byScope[scope])}</p>
            </Link>
          ))}
        </div>
      </Card>

      {!hasAnyMovement ? (
        <Card className="py-10 text-center">
          <p className="text-sm text-slate-400">Nenhuma movimentação neste mês com os filtros atuais.</p>
        </Card>
      ) : (
        <>
          <Card>
            <CardTitle>Despesas por categoria</CardTitle>
            <CategoryDonutChart data={byCategory.map((c) => ({ name: c.name, totalCents: c.totalCents }))} />
          </Card>

          <Card>
            <CardTitle className="mb-2">Onde gastamos nosso dinheiro?</CardTitle>
            <ul className="space-y-2">
              {byCategory.slice(0, 8).map((c, i) => (
                <li key={c.categoryId ?? '__none__'}>
                  <Link
                    href={withMonth(monthKey, { categoryId: c.categoryId ?? 'none' })}
                    className="flex items-center justify-between rounded-lg px-1 py-1 text-sm hover:bg-slate-50"
                  >
                    <span className="flex items-center gap-2 text-slate-700">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: categoryPalette[i % categoryPalette.length] }}
                      />
                      {c.name}
                    </span>
                    <span className="font-medium text-slate-900">{formatCentsToBRL(c.totalCents)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardTitle className="mb-2">Maiores despesas do mês</CardTitle>
            <ul className="space-y-2">
              {ranking.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/transactions/${t.id}/edit`}
                    className="flex items-center justify-between rounded-lg px-1 py-1 text-sm hover:bg-slate-50"
                  >
                    <span className="min-w-0 truncate text-slate-700">{t.description}</span>
                    <span className="ml-2 shrink-0 font-medium text-expense">{formatCentsToBRL(t.amount_cents)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <Card>
        <CardTitle>Evolução (6 meses)</CardTitle>
        <MonthlyEvolutionChart data={trend} />
      </Card>

      <Link
        href="/transactions"
        className="block rounded-2xl border border-dashed border-brand-300 bg-brand-50 p-4 text-center text-sm font-medium text-brand-700"
      >
        + Adicionar lançamento
      </Link>
    </div>
  );
}
