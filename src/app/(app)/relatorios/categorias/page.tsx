import Link from 'next/link';
import { requireCurrentUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { getCategoryOptions } from '@/lib/categories';
import { formatCentsToBRL } from '@/lib/format';
import { parseMonthParam, shiftMonthParam } from '@/lib/month';
import { getMonthTransactions, summarizeByCategory, topExpenses } from '@/lib/dashboard';
import { Card, CardTitle } from '@/components/ui/Card';
import { CategoryDonutChart, categoryPalette } from '@/components/charts/CategoryDonutChart';

export default async function CategoriasReportPage({ searchParams }: { searchParams: { month?: string } }) {
  const user = await requireCurrentUser();
  const supabase = createClient();
  const { year, month, start, end } = parseMonthParam(searchParams.month);

  const [categories, transactions] = await Promise.all([
    getCategoryOptions(supabase),
    getMonthTransactions(supabase, user.householdId, start, end, {}),
  ]);

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const byCategory = summarizeByCategory(transactions, categoryNameById);
  const ranking = topExpenses(transactions, 10);
  const monthLabel = start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const totalExpense = byCategory.reduce((s, c) => s + c.totalCents, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Categorias</h1>
        <p className="text-sm text-slate-500">Onde o casal mais gastou.</p>
      </div>

      <div className="flex items-center justify-between">
        <Link href={`/relatorios/categorias?month=${shiftMonthParam(year, month, -1)}`} className="p-2 text-slate-400">
          ‹
        </Link>
        <p className="text-sm font-medium capitalize text-slate-900">{monthLabel}</p>
        <Link href={`/relatorios/categorias?month=${shiftMonthParam(year, month, 1)}`} className="p-2 text-slate-400">
          ›
        </Link>
      </div>

      {byCategory.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="text-sm text-slate-400">Nenhuma despesa neste mês.</p>
        </Card>
      ) : (
        <>
          <Card className="text-center">
            <p className="text-xs text-slate-500">Total gasto</p>
            <p className="mt-1 text-lg font-semibold text-expense">{formatCentsToBRL(totalExpense)}</p>
          </Card>

          <Card>
            <CardTitle>Distribuição por categoria</CardTitle>
            <CategoryDonutChart data={byCategory.map((c) => ({ name: c.name, totalCents: c.totalCents }))} />
          </Card>

          <Card>
            <CardTitle className="mb-2">Onde gastamos nosso dinheiro?</CardTitle>
            <ul className="space-y-2">
              {byCategory.map((c, i) => (
                <li key={c.categoryId ?? '__none__'} className="flex items-center justify-between px-1 py-1 text-sm">
                  <span className="flex items-center gap-2 text-slate-700">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: categoryPalette[i % categoryPalette.length] }}
                    />
                    {c.name}
                  </span>
                  <span className="font-medium text-slate-900">{formatCentsToBRL(c.totalCents)}</span>
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
    </div>
  );
}
