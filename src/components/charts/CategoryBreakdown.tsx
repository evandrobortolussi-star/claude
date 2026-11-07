'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatCentsToBRL, formatDate } from '@/lib/format';

// Neutral, non-semantic palette for "what category" — green/copper are
// reserved for income/expense elsewhere on the dashboard.
const PALETTE = ['#6366f1', '#0ea5e9', '#8b5cf6', '#14b8a6', '#f59e0b', '#ec4899', '#64748b', '#94a3b8'];

export { PALETTE as categoryPalette };

export type CategoryBreakdownItem = { categoryId: string | null; name: string; totalCents: number };
export type CategoryBreakdownTransaction = {
  id: string;
  categoryId: string | null;
  description: string;
  amountCents: number;
  occurredOn: string;
};

/**
 * A single proportional bar across every category (tap-free overview) plus
 * a list where tapping one category expands it in place to show the
 * transactions behind that total — no separate chart + separate list, one
 * interactive breakdown.
 */
export function CategoryBreakdown({
  items,
  transactions,
}: {
  items: CategoryBreakdownItem[];
  transactions: CategoryBreakdownTransaction[];
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const totalCents = items.reduce((s, i) => s + i.totalCents, 0);

  if (items.length === 0 || totalCents === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">Nenhuma despesa neste período.</p>;
  }

  return (
    <div>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {items.map((item, i) => (
          <div
            key={item.categoryId ?? '__none__'}
            style={{ width: `${(item.totalCents / totalCents) * 100}%`, backgroundColor: PALETTE[i % PALETTE.length] }}
          />
        ))}
      </div>

      <div className="mt-4 divide-y divide-line border-t border-line">
        {items.map((item, i) => {
          const key = item.categoryId ?? '__none__';
          const isOpen = openKey === key;
          const itemTransactions = transactions
            .filter((t) => (t.categoryId ?? '__none__') === key)
            .sort((a, b) => b.amountCents - a.amountCents);

          return (
            <div key={key}>
              <button
                type="button"
                onClick={() => setOpenKey(isOpen ? null : key)}
                className="flex w-full items-center gap-2 py-2.5 text-left"
              >
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
                <span className="flex-1 truncate text-sm text-slate-700">{item.name}</span>
                <span className="font-mono text-sm text-slate-900">{formatCentsToBRL(item.totalCents)}</span>
                <span className="text-xs text-faint">{isOpen ? '▴' : '▾'}</span>
              </button>
              {isOpen && (
                <div className="space-y-1.5 pb-3 pl-4">
                  {itemTransactions.map((t) => (
                    <Link
                      key={t.id}
                      href={`/transactions/${t.id}/edit`}
                      className="flex items-center gap-2 py-0.5 text-xs text-slate-600 hover:text-slate-900"
                    >
                      <span className="min-w-0 flex-1 truncate">{t.description}</span>
                      <span className="shrink-0 text-faint">{formatDate(t.occurredOn)}</span>
                      <span className="shrink-0 font-mono text-slate-900">{formatCentsToBRL(t.amountCents)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
