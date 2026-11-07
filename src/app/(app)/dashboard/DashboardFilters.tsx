'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Select } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import { SCOPE_LABEL } from '@/lib/labels';

export function DashboardFilters({
  accounts,
  cards,
  categories,
}: {
  accounts: { id: string; name: string }[];
  cards: { id: string; name: string }[];
  categories: { id: string; name: string; groupName: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/dashboard?${params.toString()}`);
  }

  const scopeValue = searchParams.get('scope') ?? '';
  const scopeOptions = [
    { value: '', label: 'Todos' },
    ...Object.entries(SCOPE_LABEL).map(([value, label]) => ({ value, label })),
  ];

  const hasActiveFilter = ['scope', 'accountId', 'cardId', 'categoryId'].some((k) => searchParams.get(k));

  return (
    <div className="space-y-2">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
        {scopeOptions.map((opt) => (
          <button
            key={opt.value || 'all'}
            type="button"
            onClick={() => setParam('scope', opt.value)}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors',
              scopeValue === opt.value ? 'border-brand-600 bg-brand-600 text-cream' : 'border-line bg-cream text-slate-600',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <Select
        aria-label="Categoria"
        value={searchParams.get('categoryId') ?? ''}
        onChange={(e) => setParam('categoryId', e.target.value)}
        className="text-sm"
      >
        <option value="">Todas as categorias</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.groupName} · {c.name}
          </option>
        ))}
      </Select>
      <div className="grid grid-cols-2 gap-2">
        <Select
          aria-label="Conta"
          value={searchParams.get('accountId') ?? ''}
          onChange={(e) => setParam('accountId', e.target.value)}
          className="text-sm"
        >
          <option value="">Todas as contas</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Cartão"
          value={searchParams.get('cardId') ?? ''}
          onChange={(e) => setParam('cardId', e.target.value)}
          className="text-sm"
        >
          <option value="">Todos os cartões</option>
          {cards.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <button
        type="button"
        onClick={() => router.push(`/dashboard${searchParams.get('month') ? `?month=${searchParams.get('month')}` : ''}`)}
        className={cn('text-xs font-medium text-brand-600', !hasActiveFilter && 'invisible')}
      >
        Limpar filtros
      </button>
    </div>
  );
}
