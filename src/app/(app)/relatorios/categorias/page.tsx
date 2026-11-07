import Link from 'next/link';
import { requireCurrentUser } from '@/lib/session';
import { getCategoryOptions } from '@/lib/categories';
import { formatCentsToBRL, initials } from '@/lib/format';
import { parseMonthParam, shiftMonthParam } from '@/lib/month';
import { getMonthTransactions, summarizeByCategory, topExpenses } from '@/lib/dashboard';
import { Card, CardTitle } from '@/components/ui/Card';
import { CategoryBreakdown } from '@/components/charts/CategoryBreakdown';

export default async function CategoriasReportPage({ searchParams }: { searchParams: { month?: string } }) {
  const user = await requireCurrentUser();
  const { year, month, start, end } = parseMonthParam(searchParams.month);

  const [categories, transactions] = await Promise.all([
    getCategoryOptions(),
    getMonthTransactions(user.householdId, start, end, {}),
  ]);

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
  const byCategory = summarizeByCategory(transactions, categoryNameById);
  const ranking = topExpenses(transactions, 10);
  const monthLabel = start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const totalExpense = byCategory.reduce((s, c) => s + c.totalCents, 0);
  const expenseTransactions = transactions.filter((t) => t.type === 'EXPENSE');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-lg font-semibold text-slate-900">Categorias</h1>
        <p className="text-sm text-slate-500">Onde o casal mais gastou.</p>
      </div>

      <div className="flex items-center justify-between">
        <Link
          href={`/relatorios/categorias?month=${shiftMonthParam(year, month, -1)}`}
          className="grid size-9 place-items-center rounded-full border border-line bg-cream text-slate-500"
        >
          ‹
        </Link>
        <p className="text-sm font-medium capitalize text-slate-900">{monthLabel}</p>
        <Link
          href={`/relatorios/categorias?month=${shiftMonthParam(year, month, 1)}`}
          className="grid size-9 place-items-center rounded-full border border-line bg-cream text-slate-500"
        >
          ›
        </Link>
      </div>

      {byCategory.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="text-sm text-slate-400">Nenhuma despesa neste mês.</p>
        </Card>
      ) : (
        <>
          <Card className="border-brand-700 bg-brand-700 text-center text-cream">
            <span className="label-caps text-cream/60">Total gasto</span>
            <p className="mt-1 font-display text-2xl font-medium">{formatCentsToBRL(totalExpense)}</p>
          </Card>

          <Card>
            <CardTitle className="mb-3">Onde gastamos nosso dinheiro?</CardTitle>
            <CategoryBreakdown items={byCategory} transactions={expenseTransactions} />
          </Card>

          <Card>
            <CardTitle className="mb-2">Maiores despesas do mês</CardTitle>
            <ul className="space-y-1">
              {ranking.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/transactions/${t.id}/edit`}
                    className="flex items-center gap-3 rounded-lg px-1 py-2 text-sm hover:bg-paper"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-paper">
                      <span className="font-display text-sm italic text-brand-700">{initials(t.description)}</span>
                    </span>
                    <span className="min-w-0 flex-1 truncate text-slate-700">{t.description}</span>
                    <span className="shrink-0 font-mono font-medium text-expense">{formatCentsToBRL(t.amountCents)}</span>
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
