'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import type { CategoryOption } from '@/lib/categories';
import { SCOPE_LABEL } from '@/lib/labels';

type Account = { id: string; name: string };
type CreditCard = { id: string; name: string };

export function TransactionForm({
  action,
  categories,
  accounts,
  cards,
  allowRepetition = false,
  defaultValues,
  submitLabel = 'Salvar lançamento',
}: {
  action: (formData: FormData) => void;
  categories: CategoryOption[];
  accounts: Account[];
  cards: CreditCard[];
  allowRepetition?: boolean;
  defaultValues?: {
    type: 'INCOME' | 'EXPENSE';
    amount: string;
    description: string;
    occurredOn: string;
    categoryId?: string | null;
    accountId?: string | null;
    cardId?: string | null;
    scope?: string;
    notes?: string | null;
  };
  submitLabel?: string;
}) {
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>(defaultValues?.type ?? 'EXPENSE');
  const [repetition, setRepetition] = useState<'single' | 'installments' | 'recurring'>('single');

  const groupedCategories = useMemo(() => {
    const filtered = categories.filter((c) => c.kind === type);
    const groups = new Map<string, CategoryOption[]>();
    for (const cat of filtered) {
      const list = groups.get(cat.groupName) ?? [];
      list.push(cat);
      groups.set(cat.groupName, list);
    }
    return Array.from(groups.entries());
  }, [categories, type]);

  return (
    <form action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {(['EXPENSE', 'INCOME'] as const).map((option) => (
          <label
            key={option}
            className={cn(
              'flex cursor-pointer items-center justify-center rounded-xl border py-2.5 text-sm font-medium',
              type === option
                ? option === 'EXPENSE'
                  ? 'border-red-200 bg-red-50 text-red-600'
                  : 'border-brand-200 bg-brand-50 text-brand-700'
                : 'border-slate-200 text-slate-500',
            )}
          >
            <input
              type="radio"
              name="type"
              value={option}
              className="sr-only"
              checked={type === option}
              onChange={() => setType(option)}
            />
            {option === 'EXPENSE' ? 'Despesa' : 'Receita'}
          </label>
        ))}
      </div>

      <div>
        <Label htmlFor="amount">{repetition === 'installments' ? 'Valor total da compra' : 'Valor'}</Label>
        <Input id="amount" name="amount" placeholder="0,00" inputMode="decimal" defaultValue={defaultValues?.amount} required />
      </div>

      <div>
        <Label htmlFor="description">Descrição</Label>
        <Input id="description" name="description" placeholder="Ex: Supermercado" defaultValue={defaultValues?.description} required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="occurredOn">Data</Label>
          <Input id="occurredOn" name="occurredOn" type="date" defaultValue={defaultValues?.occurredOn} required />
        </div>
        <div>
          <Label htmlFor="categoryId">Categoria</Label>
          <Select id="categoryId" name="categoryId" defaultValue={defaultValues?.categoryId ?? ''}>
            <option value="">Sem categoria</option>
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
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="accountId">Conta</Label>
          <Select id="accountId" name="accountId" defaultValue={defaultValues?.accountId ?? ''}>
            <option value="">—</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="cardId">Cartão</Label>
          <Select id="cardId" name="cardId" defaultValue={defaultValues?.cardId ?? ''}>
            <option value="">—</option>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="scope">Responsável</Label>
        <Select id="scope" name="scope" defaultValue={defaultValues?.scope ?? 'FAMILY'}>
          {Object.entries(SCOPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {allowRepetition && (
        <div>
          <Label>Repetição</Label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ['single', 'Único'],
                ['installments', 'Parcelado'],
                ['recurring', 'Recorrente'],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={cn(
                  'flex cursor-pointer items-center justify-center rounded-xl border py-2 text-xs font-medium',
                  repetition === value ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500',
                )}
              >
                <input
                  type="radio"
                  name="repetition"
                  value={value}
                  className="sr-only"
                  checked={repetition === value}
                  onChange={() => setRepetition(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}

      {allowRepetition && repetition === 'installments' && (
        <div>
          <Label htmlFor="installments">Número de parcelas</Label>
          <Input id="installments" name="installments" type="number" min={2} max={60} defaultValue={2} required />
        </div>
      )}

      {allowRepetition && repetition === 'recurring' && (
        <div>
          <Label htmlFor="endDate">Repetir até (opcional)</Label>
          <Input id="endDate" name="endDate" type="date" />
        </div>
      )}

      <div>
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={defaultValues?.notes ?? ''} />
      </div>

      <Button type="submit" className="w-full">
        {submitLabel}
      </Button>
    </form>
  );
}
