import { SectionLink } from '@/components/SectionMenu';

export default function RelatoriosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Relatórios</h1>
        <p className="text-sm text-slate-500">Entenda para onde o dinheiro está indo.</p>
      </div>

      <div className="space-y-2">
        <SectionLink href="/relatorios/evolucao" icon="📈" label="Evolução mensal" description="Receitas x despesas nos últimos meses" />
        <SectionLink href="/relatorios/categorias" icon="🏷️" label="Categorias" description="Onde o casal mais gasta" />
        <SectionLink href="/relatorios/responsaveis" icon="👥" label="Casal x individuais" description="Comparativo de gastos por responsável" />
      </div>
    </div>
  );
}
