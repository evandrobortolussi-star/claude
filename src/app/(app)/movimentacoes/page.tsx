import { requireCurrentUser } from '@/lib/session';
import { countPendingStaged } from '@/lib/firestore/importBatches';
import { SectionLink } from '@/components/SectionMenu';

export default async function MovimentacoesPage() {
  const user = await requireCurrentUser();
  const pendingCount = await countPendingStaged(user.householdId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Movimentações</h1>
        <p className="text-sm text-slate-500">Tudo o que entrou e saiu do bolso do casal.</p>
      </div>

      <div className="space-y-2">
        <SectionLink href="/transactions" icon="📋" label="Todas" description="Receitas e despesas do mês" />
        <SectionLink
          href="/import/review"
          icon="🔍"
          label="Pendentes de classificação"
          description="Revisar importações antes de confirmar"
          badge={pendingCount}
        />
        <SectionLink href="/transactions?type=INCOME" icon="💰" label="Receitas" />
        <SectionLink href="/transactions?type=EXPENSE" icon="💸" label="Despesas" />
      </div>
    </div>
  );
}
