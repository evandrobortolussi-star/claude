import Link from 'next/link';
import { requireCurrentUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { formatCentsToBRL } from '@/lib/format';
import { parseMonthParam, shiftMonthParam } from '@/lib/month';
import { getMonthTransactions, getMonthlyTrendByScope, summarizeByScope } from '@/lib/dashboard';
import { Card, CardTitle } from '@/components/ui/Card';
import { MonthlyScopeChart } from '@/components/charts/MonthlyScopeChart';
import { SCOPE_LABEL } from '@/lib/labels';
import type { ExpenseScope } from '@/types/database';

export default async function ResponsaveisReportPage({ searchParams }: { searchParams: { month?: string } }) {
  const user = await requireCurrentUser();
  const supabase = createClient();
  const { year, month, start, end } = parseMonthParam(searchParams.month);

  const [transactions, trend] = await Promise.all([
    getMonthTransactions(supabase, user.householdId, start, end, {}),
    getMonthlyTrendByScope(supabase, user.householdId, start, 6),
  ]);

  const byScope = summarizeByScope(transactions);
  const total = byScope.FAMILY + byScope.SPOUSE_1 + byScope.SPOUSE_2;
  const monthLabel = start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Casal x individuais</h1>
        <p className="text-sm text-slate-500">Quem gastou o quê, todo mês.</p>
      </div>

      <div className="flex items-center justify-between">
        <Link href={`/relatorios/responsaveis?month=${shiftMonthParam(year, month, -1)}`} className="p-2 text-slate-400">
          ‹
        </Link>
        <p className="text-sm font-medium capitalize text-slate-900">{monthLabel}</p>
        <Link href={`/relatorios/responsaveis?month=${shiftMonthParam(year, month, 1)}`} className="p-2 text-slate-400">
          ›
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(SCOPE_LABEL) as ExpenseScope[]).map((scope) => (
          <Card key={scope} className="p-3 text-center">
            <p className="text-[11px] text-slate-500">{SCOPE_LABEL[scope]}</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatCentsToBRL(byScope[scope])}</p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              {total > 0 ? `${Math.round((byScope[scope] / total) * 100)}%` : '—'}
            </p>
          </Card>
        ))}
      </div>

      <Card>
        <CardTitle>Evolução por responsável (6 meses)</CardTitle>
        <MonthlyScopeChart data={trend} />
      </Card>
    </div>
  );
}
