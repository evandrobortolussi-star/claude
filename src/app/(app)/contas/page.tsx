import { SectionLink } from '@/components/SectionMenu';

export default function ContasPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Contas</h1>
        <p className="text-sm text-slate-500">Onde o dinheiro do casal está.</p>
      </div>

      <div className="space-y-2">
        <SectionLink href="/accounts" icon="🏦" label="Bancos" description="Contas correntes, poupanças e dinheiro" />
        <SectionLink href="/cards" icon="💳" label="Cartões" description="Limite, fechamento e faturas" />
        <SectionLink href="/investments" icon="📈" label="Investimentos" description="Aportes e resgates" />
        <SectionLink href="/loans" icon="🏷️" label="Empréstimos" description="Financiamentos e saldo devedor" />
        <SectionLink href="/transfers" icon="🔁" label="Transferências" description="Entre contas do casal" />
      </div>
    </div>
  );
}
