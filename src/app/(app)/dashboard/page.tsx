import { requireCurrentUser } from '@/lib/session';
import { ComingSoon } from '@/components/ComingSoon';

export default async function DashboardPage() {
  const user = await requireCurrentUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Olá, {user.fullName.split(' ')[0]} 👋</h1>
        <p className="text-sm text-slate-500">Sua família e seu login já estão prontos e seguros.</p>
      </div>
      <ComingSoon
        icon="📊"
        title="Seu resumo financeiro chega em breve"
        description="Nesta primeira etapa focamos em autenticação, perfil e a estrutura da família. Contas, lançamentos e gráficos vêm nas próximas etapas."
      />
    </div>
  );
}
