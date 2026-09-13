import { ComingSoon } from '@/components/ComingSoon';

export default function InvestmentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Investimentos</h1>
        <p className="text-sm text-slate-500">Acompanhe onde o patrimônio do casal está aplicado.</p>
      </div>
      <ComingSoon
        icon="📈"
        title="Investimentos chegam em breve"
        description="Cadastro de investimentos, empréstimos e financiamentos fará parte de uma próxima etapa."
      />
    </div>
  );
}
