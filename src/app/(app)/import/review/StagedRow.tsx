'use client';

import { useMemo, useState } from 'react';
import { Select, Label } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton';
import { cn } from '@/lib/cn';
import { formatCentsToBRL, formatDate } from '@/lib/format';
import type { CategoryOption } from '@/lib/categories';
import type { StagedStatus } from '@/types/database';
import { SCOPE_LABEL } from '@/lib/labels';
import { confirmStagedTransaction, ignoreStagedTransaction } from './actions';

export function StagedRow({
  staged,
  categories,
  duplicateHint,
}: {
  staged: {
    id: string;
    description: string;
    occurred_on: string;
    amount_cents: number;
    type: 'INCOME' | 'EXPENSE';
    status: StagedStatus;
    category_id: string | null;
    scope: string;
    possible_duplicate: boolean;
    matched_rule_id: string | null;
  };
  categories: CategoryOption[];
  duplicateHint: string | null;
}) {
  const [categoryId, setCategoryId] = useState(staged.category_id ?? '');
  const [scope, setScope] = useState(staged.scope);

  const confirmAction = confirmStagedTransaction.bind(null, staged.id);
  const ignoreAction = ignoreStagedTransaction.bind(null, staged.id);

  const groupedCategories = useMemo(() => {
    const filtered = categories.filter((c) => c.kind === staged.type);
    const groups = new Map<string, CategoryOption[]>();
    for (const cat of filtered) {
      const list = groups.get(cat.groupName) ?? [];
      list.push(cat);
      groups.set(cat.groupName, list);
    }
    return Array.from(groups.entries());
  }, [categories, staged.type]);

  return (
    <div
      className={cn(
        'rounded-2xl border bg-white p-4 shadow-card',
        staged.possible_duplicate ? 'border-amber-300' : 'border-slate-100',
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{staged.description}</p>
          <p className="text-xs text-slate-500">{formatDate(staged.occurred_on)}</p>
        </div>
        <span className={staged.type === 'INCOME' ? 'font-semibold text-income' : 'font-semibold text-expense'}>
          {staged.type === 'INCOME' ? '+' : '-'}
          {formatCentsToBRL(staged.amount_cents)}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-medium',
            staged.status === 'SUGGESTED' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-500',
          )}
        >
          {staged.status === 'SUGGESTED' ? 'Sugestão automática' : 'Ainda não classificada'}
        </span>
        {staged.possible_duplicate && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            Possível duplicata
          </span>
        )}
      </div>

      {duplicateHint && <p className="mb-3 text-xs text-amber-700">Já existe algo parecido: {duplicateHint}</p>}

      <form action={confirmAction} className="space-y-2">
        <div>
          <Label htmlFor={`category-${staged.id}`}>Categoria</Label>
          <Select
            id={`category-${staged.id}`}
            name="categoryId"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            <option value="" disabled>
              Selecione
            </option>
            {groupedCategories.map(([groupName, cats]) => (
              <optgroup key={groupName} label={groupName}>
                {cats.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`scope-${staged.id}`}>Responsável</Label>
          <Select id={`scope-${staged.id}`} name="scope" value={scope} onChange={(e) => setScope(e.target.value)}>
            {Object.entries(SCOPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <Button type="submit" className="flex-1" disabled={!categoryId}>
            Confirmar
          </Button>
        </div>
      </form>
      <form action={ignoreAction} className="mt-1 text-center">
        <ConfirmSubmitButton confirmMessage="Ignorar esta movimentação? Ela some da revisão, mas fica no histórico da importação.">
          Ignorar
        </ConfirmSubmitButton>
      </form>
    </div>
  );
}
