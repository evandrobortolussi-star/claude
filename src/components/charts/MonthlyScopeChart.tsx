'use client';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';
import { formatCentsToBRL } from '@/lib/format';
import { SCOPE_LABEL } from '@/lib/labels';
import type { MonthlyScopePoint } from '@/lib/dashboard';

const SCOPE_COLOR: Record<'FAMILY' | 'SPOUSE_1' | 'SPOUSE_2', string> = {
  FAMILY: '#6366f1',
  SPOUSE_1: '#0ea5e9',
  SPOUSE_2: '#f59e0b',
};

export function MonthlyScopeChart({ data }: { data: MonthlyScopePoint[] }) {
  const hasAny = data.some((d) => d.FAMILY > 0 || d.SPOUSE_1 > 0 || d.SPOUSE_2 > 0);
  if (!hasAny) {
    return <p className="py-10 text-center text-sm text-slate-400">Sem despesas nos últimos meses.</p>;
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={3}>
          <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="#94a3b8" />
          <YAxis hide />
          <Tooltip
            formatter={(value: number, key: string) => [formatCentsToBRL(value), SCOPE_LABEL[key as keyof typeof SCOPE_LABEL]]}
            contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
          />
          <Legend
            formatter={(key: string) => SCOPE_LABEL[key as keyof typeof SCOPE_LABEL]}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="FAMILY" fill={SCOPE_COLOR.FAMILY} radius={[4, 4, 0, 0]} />
          <Bar dataKey="SPOUSE_1" fill={SCOPE_COLOR.SPOUSE_1} radius={[4, 4, 0, 0]} />
          <Bar dataKey="SPOUSE_2" fill={SCOPE_COLOR.SPOUSE_2} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
