import { ComingSoon } from '@/components/ComingSoon';

export default function TransactionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Lançamentos</h1>
        <p className="text-sm text-slate-500">Receitas e despesas do casal.</p>
      </div>
      <ComingSoon
        icon="📋"
        title="Lançamentos chegam na próxima etapa"
        description="Você poderá registrar receitas e despesas, classificá-las como familiares ou individuais, e sempre corrigir a categoria."
      />
    </div>
  );
}
