import { notFound } from 'next/navigation';
import { requireCurrentUser } from '@/lib/session';
import { getTransaction } from '@/lib/firestore/transactions';
import { listActiveAccounts } from '@/lib/firestore/accounts';
import { listActiveCards } from '@/lib/firestore/cards';
import { getCategoryOptions } from '@/lib/categories';
import { formatCentsToBRL, toDateInputValue } from '@/lib/format';
import { Card, CardTitle } from '@/components/ui/Card';
import { updateTransaction } from '../../actions';
import { TransactionForm } from '../../TransactionForm';

export default async function EditTransactionPage({ params }: { params: { id: string } }) {
  const user = await requireCurrentUser();

  const [transaction, categories, accounts, cards] = await Promise.all([
    getTransaction(user.householdId, params.id),
    getCategoryOptions(),
    listActiveAccounts(user.householdId),
    listActiveCards(user.householdId),
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
          accounts={accounts}
          cards={cards}
          submitLabel="Salvar alterações"
          defaultValues={{
            type: transaction.type,
            amount: formatCentsToBRL(transaction.amountCents),
            description: transaction.description,
            occurredOn: toDateInputValue(transaction.occurredOn),
            categoryId: transaction.categoryId,
            accountId: transaction.accountId,
            cardId: transaction.cardId,
            scope: transaction.scope,
            notes: transaction.notes,
          }}
        />
      </Card>
    </div>
  );
}
