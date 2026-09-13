import { requireCurrentUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { getCategoryOptions } from '@/lib/categories';
import { formatCentsToBRL, formatDate } from '@/lib/format';
import { StagedRow } from './StagedRow';

export default async function ReviewImportsPage() {
  const user = await requireCurrentUser();
  const supabase = createClient();

  const [{ data: staged }, categories] = await Promise.all([
    supabase
      .from('import_staged_transactions')
      .select(
        'id, description, occurred_on, amount_cents, type, status, category_id, scope, possible_duplicate, duplicate_of_transaction_id, matched_rule_id',
      )
      .eq('household_id', user.householdId)
      .in('status', ['PENDING', 'SUGGESTED'])
      .order('occurred_on', { ascending: false }),
    getCategoryOptions(supabase),
  ]);

  const duplicateIds = Array.from(
    new Set((staged ?? []).map((s) => s.duplicate_of_transaction_id).filter((id): id is string => !!id)),
  );

  const { data: duplicateTransactions } =
    duplicateIds.length > 0
      ? await supabase.from('transactions').select('id, description, occurred_on, amount_cents').in('id', duplicateIds)
      : { data: [] };

  const duplicateById = new Map((duplicateTransactions ?? []).map((t) => [t.id, t]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Revisar movimentações</h1>
        <p className="text-sm text-slate-500">Categoria → responsável → confirmar. Rápido e sem surpresas.</p>
      </div>

      <div className="space-y-3">
        {(!staged || staged.length === 0) && (
          <p className="text-sm text-slate-400">Nenhuma movimentação pendente de revisão.</p>
        )}
        {staged?.map((s) => {
          const dup = s.duplicate_of_transaction_id ? duplicateById.get(s.duplicate_of_transaction_id) : null;
          const duplicateHint = dup
            ? `${dup.description} em ${formatDate(dup.occurred_on)} (${formatCentsToBRL(dup.amount_cents)})`
            : null;
          return <StagedRow key={s.id} staged={s} categories={categories} duplicateHint={duplicateHint} />;
        })}
      </div>
    </div>
  );
}
