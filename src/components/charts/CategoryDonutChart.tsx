'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCentsToBRL } from '@/lib/format';

export type CategorySlice = { name: string; totalCents: number };

// Neutral, non-semantic palette for "what category" — green/red are
// reserved for income/expense elsewhere on the dashboard.
const PALETTE = ['#6366f1', '#0ea5e9', '#8b5cf6', '#14b8a6', '#f59e0b', '#ec4899', '#64748b', '#94a3b8'];

export function CategoryDonutChart({ data }: { data: CategorySlice[] }) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">Nenhuma despesa neste período.</p>;
  }

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="totalCents" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">
            {data.map((slice, i) => (
              <Cell key={slice.name} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [formatCentsToBRL(value), name]}
            contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export { PALETTE as categoryPalette };
