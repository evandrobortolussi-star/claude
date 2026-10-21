import { requireCurrentUser } from '@/lib/session';
import { getCategoryOptions } from '@/lib/categories';
import { getTransactionsByIds, listPendingStaged } from '@/lib/firestore/importBatches';
import { formatCentsToBRL, formatDate } from '@/lib/format';
import { StagedRow } from './StagedRow';

export default async function ReviewImportsPage() {
  const user = await requireCurrentUser();

  const [staged, categories] = await Promise.all([
    listPendingStaged(user.householdId),
    getCategoryOptions(),
  ]);

  const duplicateIds = Array.from(
    new Set(staged.map((s) => s.duplicateOfTransactionId).filter((id): id is string => !!id)),
  );
  const duplicateById = await getTransactionsByIds(user.householdId, duplicateIds);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Revisar movimentações</h1>
        <p className="text-sm text-slate-500">Categoria → responsável → confirmar. Rápido e sem surpresas.</p>
      </div>

      <div className="space-y-3">
        {staged.length === 0 && <p className="text-sm text-slate-400">Nenhuma movimentação pendente de revisão.</p>}
        {staged.map((s) => {
          const dup = s.duplicateOfTransactionId ? duplicateById.get(s.duplicateOfTransactionId) : null;
          const duplicateHint = dup ? `${dup.description} em ${formatDate(dup.occurredOn)} (${formatCentsToBRL(dup.amountCents)})` : null;
          return <StagedRow key={s.id} staged={s} categories={categories} duplicateHint={duplicateHint} />;
        })}
      </div>
    </div>
  );
}
