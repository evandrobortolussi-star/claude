import Link from 'next/link';
import { ComingSoon } from '@/components/ComingSoon';
import { Card, CardTitle } from '@/components/ui/Card';

export default function BancosConectadosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Bancos conectados</h1>
        <p className="text-sm text-slate-500">Conexão automática via Open Finance.</p>
      </div>

      <ComingSoon
        icon="🔗"
        title="Ainda não disponível"
        description="Por enquanto o Financeiro Familiar funciona 100% manual: você cadastra contas e cartões, registra lançamentos ou importa extratos CSV/OFX. A conexão automática com bancos é uma etapa futura, depois de validarmos bem essa base com você."
      />

      <Card>
        <CardTitle className="mb-2">O que já está pronto para isso</CardTitle>
        <ul className="list-disc space-y-1 pl-4 text-sm text-slate-600">
          <li>Nenhuma senha ou credencial bancária é pedida ou armazenada aqui, hoje ou no futuro.</li>
          <li>Quando a conexão chegar, o token de acesso do banco ficará num cofre de segredos dedicado — nunca nesta base de dados.</li>
          <li>
            Por enquanto, use{' '}
            <Link href="/import" className="font-medium text-brand-600">
              Importar extrato
            </Link>{' '}
            para trazer suas movimentações rapidamente.
          </li>
        </ul>
      </Card>
    </div>
  );
}
