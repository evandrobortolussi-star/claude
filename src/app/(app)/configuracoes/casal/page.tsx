import { requireCurrentUser } from '@/lib/session';
import { getHousehold, listHouseholdMembers } from '@/lib/firestore/households';
import { Card, CardTitle } from '@/components/ui/Card';
import { HouseholdForm } from '../../profile/HouseholdForm';

export default async function CasalPage() {
  const user = await requireCurrentUser();

  const [household, members] = await Promise.all([
    getHousehold(user.householdId),
    listHouseholdMembers(user.householdId),
  ]);

  const spouse = members.find((m) => m.id !== user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Casal</h1>
        <p className="text-sm text-slate-500">Sua família compartilhada no Financeiro Familiar.</p>
      </div>

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
                <span>{spouse.avatarEmoji}</span>
                <span className="text-slate-900">{spouse.fullName}</span>
              </li>
            )}
          </ul>
        </div>

        {!spouse && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-xs font-medium text-slate-500">Convide seu parceiro(a)</p>
            <p className="mt-2 rounded-xl bg-brand-50 px-4 py-3 text-center text-xl font-semibold tracking-widest text-brand-700">
              {household?.inviteCode}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
