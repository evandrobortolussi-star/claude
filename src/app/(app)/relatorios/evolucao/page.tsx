import Link from 'next/link';
import { requireCurrentUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { formatCentsToBRL } from '@/lib/format';
import { parseMonthParam, shiftMonthParam } from '@/lib/month';
import { getMonthlyTrend } from '@/lib/dashboard';
import { Card, CardTitle } from '@/components/ui/Card';
import { MonthlyEvolutionChart } from '@/components/charts/MonthlyEvolutionChart';

export default async function EvolucaoReportPage({ searchParams }: { searchParams: { month?: string } }) {
  const user = await requireCurrentUser();
  const supabase = createClient();
  const { year, month, start } = parseMonthParam(searchParams.month);

  const trend = await getMonthlyTrend(supabase, user.householdId, start, 6, {});
  const monthLabel = start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const monthsWithData = trend.filter((t) => t.incomeCents > 0 || t.expenseCents > 0);
  const avgIncome = monthsWithData.length
    ? Math.round(monthsWithData.reduce((s, t) => s + t.incomeCents, 0) / monthsWithData.length)
    : 0;
  const avgExpense = monthsWithData.length
    ? Math.round(monthsWithData.reduce((s, t) => s + t.expenseCents, 0) / monthsWithData.length)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Evolução mensal</h1>
        <p className="text-sm text-slate-500">Receitas e despesas nos últimos 6 meses.</p>
      </div>

      <div className="flex items-center justify-between">
        <Link href={`/relatorios/evolucao?month=${shiftMonthParam(year, month, -1)}`} className="p-2 text-slate-400">
          ‹
        </Link>
        <p className="text-sm font-medium capitalize text-slate-900">até {monthLabel}</p>
        <Link href={`/relatorios/evolucao?month=${shiftMonthParam(year, month, 1)}`} className="p-2 text-slate-400">
          ›
        </Link>
      </div>

      <Card>
        <CardTitle>Receitas x despesas</CardTitle>
        <MonthlyEvolutionChart data={trend} />
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center">
          <p className="text-xs text-slate-500">Média de receitas</p>
          <p className="mt-1 font-semibold text-income">{formatCentsToBRL(avgIncome)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-slate-500">Média de despesas</p>
          <p className="mt-1 font-semibold text-expense">{formatCentsToBRL(avgExpense)}</p>
        </Card>
      </div>
    </div>
  );
}
