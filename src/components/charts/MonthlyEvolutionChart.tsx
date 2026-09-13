'use client';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCentsToBRL } from '@/lib/format';
import type { MonthlyPoint } from '@/lib/dashboard';

export function MonthlyEvolutionChart({ data }: { data: MonthlyPoint[] }) {
  const hasAny = data.some((d) => d.incomeCents > 0 || d.expenseCents > 0);
  if (!hasAny) {
    return <p className="py-10 text-center text-sm text-slate-400">Sem movimentações nos últimos meses.</p>;
  }

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={4}>
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="#94a3b8" />
          <YAxis hide />
          <Tooltip
            formatter={(value: number, key: string) => [formatCentsToBRL(value), key === 'incomeCents' ? 'Receitas' : 'Despesas']}
            contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
          />
          <Bar dataKey="incomeCents" fill="#1fa876" radius={[4, 4, 0, 0]} />
          <Bar dataKey="expenseCents" fill="#e5484d" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
