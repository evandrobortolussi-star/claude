import { notFound } from 'next/navigation';
import { requireCurrentUser } from '@/lib/session';
import { getAccount } from '@/lib/firestore/accounts';
import { formatCentsToBRL } from '@/lib/format';
import { Card, CardTitle } from '@/components/ui/Card';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { Input, Label, Select } from '@/components/ui/Input';
import { updateAccount } from '../../actions';
import { ACCOUNT_TYPE_LABEL as TYPE_LABEL } from '@/lib/labels';

export default async function EditAccountPage({ params }: { params: { id: string } }) {
  const user = await requireCurrentUser();
  const account = await getAccount(user.householdId, params.id);

  if (!account) notFound();

  const updateWithId = updateAccount.bind(null, account.id);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Editar conta</h1>
      <Card>
        <CardTitle className="mb-3">Dados da conta</CardTitle>
        <form action={updateWithId} className="space-y-3">
          <div>
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" defaultValue={account.name} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="type">Tipo</Label>
              <Select id="type" name="type" defaultValue={account.type}>
                {Object.entries(TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="openingBalance">Saldo inicial</Label>
              <Input
                id="openingBalance"
                name="openingBalance"
                defaultValue={formatCentsToBRL(account.openingBalanceCents)}
                inputMode="decimal"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="institution">Instituição</Label>
            <Input id="institution" name="institution" defaultValue={account.institution ?? ''} />
          </div>
          <SubmitButton className="w-full">Salvar alterações</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
