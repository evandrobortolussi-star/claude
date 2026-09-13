import Link from 'next/link';
import { requireCurrentUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { getCategoryOptions } from '@/lib/categories';
import { formatCentsToBRL, formatDate, toDateInputValue } from '@/lib/format';
import { Card } from '@/components/ui/Card';
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton';
import { createTransaction, deleteTransaction } from './actions';
import { TransactionForm } from './TransactionForm';
import type { ExpenseScope, TransactionType } from '@/types/database';
import { SCOPE_LABEL, TRANSACTION_TYPE_LABEL } from '@/lib/labels';
import { parseMonthParam, shiftMonthParam } from '@/lib/month';

function monthHref(month: string, searchParams: { categoryId?: string; scope?: string; type?: string }) {
  const params = new URLSearchParams({ month });
  if (searchParams.categoryId) params.set('categoryId', searchParams.categoryId);
  if (searchParams.scope) params.set('scope', searchParams.scope);
  if (searchParams.type) params.set('type', searchParams.type);
  return `/transactions?${params.toString()}`;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { month?: string; categoryId?: string; scope?: string; type?: string };
}) {
  const user = await requireCurrentUser();
  const supabase = createClient();

  // Materialize any recurring occurrences due up to today before listing.
  await supabase.rpc('generate_due_recurring_transactions', { p_household_id: user.householdId });

  const { year, month, start, end } = parseMonthParam(searchParams.month);

  let transactionsQuery = supabase
    .from('transactions')
    .select(
      'id, type, amount_cents, occurred_on, description, scope, category_id, installment_number, installment_total, import_batch_id',
    )
    .eq('household_id', user.householdId)
    .gte('occurred_on', toDateInputValue(start))
    .lt('occurred_on', toDateInputValue(end))
    .is('deleted_at', null);

  if (searchParams.categoryId === 'none') {
    transactionsQuery = transactionsQuery.is('category_id', null);
  } else if (searchParams.categoryId) {
    transactionsQuery = transactionsQuery.eq('category_id', searchParams.categoryId);
  }
  if (searchParams.scope) {
    transactionsQuery = transactionsQuery.eq('scope', searchParams.scope as ExpenseScope);
  }
  if (searchParams.type) {
    transactionsQuery = transactionsQuery.eq('type', searchParams.type as TransactionType);
  }

  const [categories, { data: accounts }, { data: cards }, { data: transactions }] = await Promise.all([
    getCategoryOptions(supabase),
    supabase
      .from('accounts')
      .select('id, name')
      .eq('household_id', user.householdId)
      .eq('archived', false)
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('credit_cards')
      .select('id, name')
      .eq('household_id', user.householdId)
      .eq('archived', false)
      .is('deleted_at', null)
      .order('name'),
    transactionsQuery.order('occurred_on', { ascending: false }),
  ]);

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  const totalIncome = (transactions ?? []).filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount_cents, 0);
  const totalExpense = (transactions ?? []).filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount_cents, 0);

  const monthLabel = start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const activeFilterLabel = searchParams.categoryId
    ? searchParams.categoryId === 'none'
      ? 'Sem categoria'
      : (categories.find((c) => c.id === searchParams.categoryId)?.name ?? 'Categoria')
    : searchParams.scope
      ? SCOPE_LABEL[searchParams.scope as ExpenseScope]
      : searchParams.type
        ? TRANSACTION_TYPE_LABEL[searchParams.type as TransactionType]
        : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Lançamentos</h1>
        <p className="text-sm text-slate-500">Receitas e despesas do casal.</p>
      </div>

      <div className="flex items-center justify-between">
        <Link href={monthHref(shiftMonthParam(year, month, -1), searchParams)} className="p-2 text-slate-400">
          ‹
        </Link>
        <p className="text-sm font-medium capitalize text-slate-900">{monthLabel}</p>
        <Link href={monthHref(shiftMonthParam(year, month, 1), searchParams)} className="p-2 text-slate-400">
          ›
        </Link>
      </div>

      {activeFilterLabel && (
        <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-xs text-slate-600">
          <span>
            Filtrando por: <strong className="font-medium text-slate-900">{activeFilterLabel}</strong>
          </span>
          <Link href={`/transactions?month=${year}-${String(month).padStart(2, '0')}`} className="font-medium text-brand-600">
            Limpar
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center">
          <p className="text-xs text-slate-500">Receitas</p>
          <p className="mt-1 font-semibold text-income">{formatCentsToBRL(totalIncome)}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-slate-500">Despesas</p>
          <p className="mt-1 font-semibold text-expense">{formatCentsToBRL(totalExpense)}</p>
        </Card>
      </div>

      <details className="group rounded-2xl border border-slate-100 bg-white shadow-card">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-brand-700">
          + Novo lançamento
        </summary>
        <div className="border-t border-slate-100 p-4">
          <TransactionForm
            action={createTransaction}
            categories={categories}
            accounts={accounts ?? []}
            cards={cards ?? []}
            allowRepetition
            defaultValues={{
              type: 'EXPENSE',
              amount: '',
              description: '',
              occurredOn: new Date().toISOString().slice(0, 10),
            }}
          />
        </div>
      </details>

      <div className="space-y-2">
        {(!transactions || transactions.length === 0) && (
          <p className="text-sm text-slate-400">Nenhum lançamento neste mês ainda.</p>
        )}
        {transactions?.map((t) => (
          <Card key={t.id} className="flex items-center justify-between p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">
                {t.description}
                {t.installment_total ? (
                  <span className="ml-1 text-xs font-normal text-slate-400">
                    ({t.installment_number}/{t.installment_total})
                  </span>
                ) : null}
                {t.import_batch_id && (
                  <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                    Importado
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500">
                {formatDate(t.occurred_on)} · {SCOPE_LABEL[t.scope]} ·{' '}
                {t.category_id ? categoryNameById.get(t.category_id) ?? 'Categoria' : 'Sem categoria'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3 pl-2">
              <span className={t.type === 'INCOME' ? 'font-semibold text-income' : 'font-semibold text-expense'}>
                {t.type === 'INCOME' ? '+' : '-'}
                {formatCentsToBRL(t.amount_cents)}
              </span>
              <Link href={`/transactions/${t.id}/edit`} className="text-xs font-medium text-brand-600">
                Editar
              </Link>
              <form action={deleteTransaction.bind(null, t.id)}>
                <ConfirmSubmitButton confirmMessage="Excluir este lançamento?">Excluir</ConfirmSubmitButton>
              </form>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
