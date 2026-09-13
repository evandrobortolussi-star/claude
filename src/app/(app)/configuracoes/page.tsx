import { SectionLink } from '@/components/SectionMenu';

export default function ConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Configurações</h1>
        <p className="text-sm text-slate-500">Sua conta, sua família e a segurança do app.</p>
      </div>

      <div className="space-y-2">
        <SectionLink href="/profile" icon="👤" label="Perfil" description="Seu nome e avatar" />
        <SectionLink href="/configuracoes/casal" icon="💑" label="Casal" description="Membros e convite da família" />
        <SectionLink href="/configuracoes/categorias" icon="🏷️" label="Categorias" description="Setores de receita e despesa" />
        <SectionLink href="/import/rules" icon="🤖" label="Regras automáticas" description="Aprendizado de classificação" />
        <SectionLink href="/import" icon="📥" label="Importações" description="Enviar um novo extrato" />
        <SectionLink href="/configuracoes/bancos" icon="🔗" label="Bancos conectados" description="Conexão automática (em breve)" />
        <SectionLink href="/configuracoes/seguranca" icon="🔒" label="Segurança" description="Como seus dados são protegidos" />
      </div>
    </div>
  );
}
