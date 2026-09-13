import { requireCurrentUser } from '@/lib/session';
import { Card, CardTitle } from '@/components/ui/Card';
import { ProfileForm } from './ProfileForm';

export default async function ProfilePage() {
  const user = await requireCurrentUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Perfil</h1>
        <p className="text-sm text-slate-500">Seu nome e avatar.</p>
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
    </div>
  );
}
