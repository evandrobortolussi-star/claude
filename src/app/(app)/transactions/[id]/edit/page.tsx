import { notFound } from 'next/navigation';
import { requireCurrentUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { getCategoryOptions } from '@/lib/categories';
import { formatCentsToBRL, toDateInputValue } from '@/lib/format';
import { Card, CardTitle } from '@/components/ui/Card';
import { updateTransaction } from '../../actions';
import { TransactionForm } from '../../TransactionForm';

export default async function EditTransactionPage({ params }: { params: { id: string } }) {
  const user = await requireCurrentUser();
  const supabase = createClient();

  const [{ data: transaction }, categories, { data: accounts }, { data: cards }] = await Promise.all([
    supabase
      .from('transactions')
      .select('id, type, amount_cents, occurred_on, description, notes, category_id, account_id, card_id, scope')
      .eq('id', params.id)
      .eq('household_id', user.householdId)
      .single(),
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
  ]);

  if (!transaction) notFound();

  const updateWithId = updateTransaction.bind(null, transaction.id);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Editar lançamento</h1>
      <p className="text-sm text-slate-500">
        Ajuste qualquer dado, incluindo a categoria e o responsável — útil para corrigir uma classificação.
      </p>
      <Card>
        <CardTitle className="mb-3">Dados do lançamento</CardTitle>
        <TransactionForm
          action={updateWithId}
          categories={categories}
          accounts={accounts ?? []}
          cards={cards ?? []}
          submitLabel="Salvar alterações"
          defaultValues={{
            type: transaction.type,
            amount: formatCentsToBRL(transaction.amount_cents),
            description: transaction.description,
            occurredOn: toDateInputValue(transaction.occurred_on),
            categoryId: transaction.category_id,
            accountId: transaction.account_id,
            cardId: transaction.card_id,
            scope: transaction.scope,
            notes: transaction.notes,
          }}
        />
      </Card>
    </div>
  );
}
