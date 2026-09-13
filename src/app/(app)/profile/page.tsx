import Link from 'next/link';
import { requireCurrentUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { Card, CardTitle } from '@/components/ui/Card';
import { ProfileForm } from './ProfileForm';
import { HouseholdForm } from './HouseholdForm';

export default async function ProfilePage() {
  const user = await requireCurrentUser();
  const supabase = createClient();

  const [{ data: household }, { data: members }] = await Promise.all([
    supabase.from('households').select('name, invite_code').eq('id', user.householdId).single(),
    supabase
      .from('profiles')
      .select('id, full_name, avatar_emoji, spouse_slot, role')
      .eq('household_id', user.householdId)
      .order('spouse_slot', { ascending: true }),
  ]);

  const spouse = members?.find((m) => m.id !== user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Perfil</h1>
        <p className="text-sm text-slate-500">Seus dados, sua família e a segurança da sua conta.</p>
      </div>

      <Card className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-2xl">
          {user.avatarEmoji}
        </span>
        <div>
          <p className="font-medium text-slate-900">{user.fullName}</p>
          <p className="text-xs text-slate-500">{user.email}</p>
        </div>
      </Card>

      <Card>
        <CardTitle className="mb-3">Editar meu perfil</CardTitle>
        <ProfileForm fullName={user.fullName} avatarEmoji={user.avatarEmoji} />
      </Card>

      <Card>
        <CardTitle className="mb-3">Família</CardTitle>
        {user.role === 'OWNER' ? (
          <HouseholdForm name={household?.name ?? ''} />
        ) : (
          <p className="text-sm text-slate-700">{household?.name}</p>
        )}

        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-xs font-medium text-slate-500">Membros</p>
          <ul className="mt-2 space-y-2">
            <li className="flex items-center gap-2 text-sm">
              <span>{user.avatarEmoji}</span>
              <span className="text-slate-900">{user.fullName}</span>
              <span className="text-xs text-slate-400">(você{user.role === 'OWNER' ? ', titular' : ''})</span>
            </li>
            {spouse && (
              <li className="flex items-center gap-2 text-sm">
                <span>{spouse.avatar_emoji}</span>
                <span className="text-slate-900">{spouse.full_name}</span>
              </li>
            )}
          </ul>
        </div>

        {!spouse && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-xs font-medium text-slate-500">Convide seu parceiro(a)</p>
            <p className="mt-2 rounded-xl bg-brand-50 px-4 py-3 text-center text-xl font-semibold tracking-widest text-brand-700">
              {household?.invite_code}
            </p>
          </div>
        )}
      </Card>

      <Card className="space-y-1">
        <CardTitle className="mb-2">Gerenciar</CardTitle>
        <SettingsLink href="/accounts" label="Contas e dinheiro" />
        <SettingsLink href="/cards" label="Cartões de crédito" />
        <SettingsLink href="/loans" label="Empréstimos e financiamentos" />
        <SettingsLink href="/transfers" label="Transferências entre contas" />
      </Card>

      <Card>
        <CardTitle className="mb-2">Segurança e privacidade</CardTitle>
        <ul className="list-disc space-y-1 pl-4 text-sm text-slate-600">
          <li>Seus dados são visíveis apenas para você e seu parceiro(a) nesta família.</li>
          <li>Todo acesso é verificado no banco de dados (Row Level Security), não apenas no app.</li>
          <li>Senhas e credenciais de bancos nunca são solicitadas ou armazenadas neste app.</li>
        </ul>
      </Card>
    </div>
  );
}

function SettingsLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between py-2.5 text-sm text-slate-700">
      {label}
      <span className="text-slate-300">›</span>
    </Link>
  );
}
