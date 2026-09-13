import Link from 'next/link';
import { Card, CardTitle } from '@/components/ui/Card';
import { ChangePasswordForm } from './ChangePasswordForm';

export default function SegurancaPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Segurança</h1>
        <p className="text-sm text-slate-500">Como seus dados financeiros são protegidos.</p>
      </div>

      <Card>
        <CardTitle className="mb-2">O que garantimos</CardTitle>
        <ul className="list-disc space-y-2 pl-4 text-sm text-slate-600">
          <li>Seus dados são visíveis apenas para você e seu parceiro(a) nesta família — nunca para outra família.</li>
          <li>
            Todo acesso é verificado no banco de dados (Row Level Security do Postgres), não apenas no aplicativo —
            mesmo que exista um bug na tela, a resposta do servidor já vem filtrada por família.
          </li>
          <li>Sua senha nunca é armazenada em texto puro — apenas um hash gerenciado pela autenticação do Supabase.</li>
          <li>Senhas e credenciais de bancos nunca são solicitadas ou armazenadas neste app.</li>
          <li>Nenhuma chave secreta do servidor fica exposta no aplicativo que roda no seu navegador ou iPhone.</li>
          <li>Excluir uma movimentação nunca é definitivo por engano — é sempre uma ação explícita e reversível.</li>
        </ul>
      </Card>

      <Card>
        <CardTitle className="mb-2">Conexão automática com bancos</CardTitle>
        <p className="text-sm text-slate-600">
          Hoje o Financeiro Familiar funciona 100% com cadastro manual e importação de extratos (CSV/OFX). A conexão
          automática via Open Finance está planejada, mas só será ativada depois de validarmos bem essa base — veja
          em{' '}
          <Link href="/configuracoes/bancos" className="font-medium text-brand-600">
            Bancos conectados
          </Link>
          .
        </p>
      </Card>

      <Card>
        <CardTitle className="mb-3">Trocar senha</CardTitle>
        <ChangePasswordForm />
      </Card>
    </div>
  );
}
