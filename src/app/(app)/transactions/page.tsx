import Link from 'next/link';
import { requireCurrentUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { getCategoryOptions } from '@/lib/categories';
import { formatCentsToBRL, formatDate, toDateInputValue } from '@/lib/format';
import { Card } from '@/components/ui/Card';
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton';
import { createTransaction, deleteTransaction } from './actions';
import { TransactionForm } from './TransactionForm';

const SCOPE_LABEL: Record<string, string> = {
  FAMILY: 'Casal',
  SPOUSE_1: 'Cônjuge 1',
  SPOUSE_2: 'Cônjuge 2',
};

function parseMonth(month?: string) {
  const now = new Date();
  const [year, m] = (month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    .split('-')
    .map(Number);
  const start = new Date(year, m - 1, 1);
  const end = new Date(year, m, 1);
  return { year, month: m, start, end };
}

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default async function TransactionsPage({ searchParams }: { searchParams: { month?: string } }) {
  const user = await requireCurrentUser();
  const supabase = createClient();

  // Materialize any recurring occurrences due up to today before listing.
  await supabase.rpc('generate_due_recurring_transactions', { p_household_id: user.householdId });

  const { year, month, start, end } = parseMonth(searchParams.month);

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
    supabase
      .from('transactions')
      .select(
        'id, type, amount_cents, occurred_on, description, scope, category_id, installment_number, installment_total, import_batch_id',
      )
      .eq('household_id', user.householdId)
      .gte('occurred_on', toDateInputValue(start))
      .lt('occurred_on', toDateInputValue(end))
      .is('deleted_at', null)
      .order('occurred_on', { ascending: false }),
  ]);

  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  const totalIncome = (transactions ?? []).filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount_cents, 0);
  const totalExpense = (transactions ?? []).filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount_cents, 0);

  const monthLabel = start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Lançamentos</h1>
        <p className="text-sm text-slate-500">Receitas e despesas do casal.</p>
      </div>

      <div className="flex items-center justify-between">
        <Link href={`/transactions?month=${shiftMonth(year, month, -1)}`} className="p-2 text-slate-400">
          ‹
        </Link>
        <p className="text-sm font-medium capitalize text-slate-900">{monthLabel}</p>
        <Link href={`/transactions?month=${shiftMonth(year, month, 1)}`} className="p-2 text-slate-400">
          ›
        </Link>
      </div>

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
