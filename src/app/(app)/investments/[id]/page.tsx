import { notFound } from 'next/navigation';
import { requireCurrentUser } from '@/lib/session';
import { getInvestment, listMovements, sumMovements } from '@/lib/firestore/investments';
import { listActiveAccounts } from '@/lib/firestore/accounts';
import { formatCentsToBRL, formatDate } from '@/lib/format';
import { Card, CardTitle } from '@/components/ui/Card';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { Input, Label, Select } from '@/components/ui/Input';
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton';
import { createInvestmentMovement, deleteInvestmentMovement } from '../actions';

export default async function InvestmentDetailPage({ params }: { params: { id: string } }) {
  const user = await requireCurrentUser();

  const investment = await getInvestment(user.householdId, params.id);
  if (!investment) notFound();

  const [movements, accounts] = await Promise.all([
    listMovements(user.householdId, params.id),
    listActiveAccounts(user.householdId),
  ]);

  const balance = sumMovements(movements);
  const addMovement = createInvestmentMovement.bind(null, investment.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{investment.name}</h1>
        <p className="text-sm text-slate-500">{investment.institution}</p>
        <p className="mt-1 text-xl font-semibold text-brand-700">{formatCentsToBRL(balance)}</p>
      </div>

      <Card>
        <CardTitle className="mb-3">Novo aporte ou resgate</CardTitle>
        <form action={addMovement} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="type">Tipo</Label>
              <Select id="type" name="type" defaultValue="CONTRIBUTION">
                <option value="CONTRIBUTION">Aporte</option>
                <option value="REDEMPTION">Resgate</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="amount">Valor</Label>
              <Input id="amount" name="amount" placeholder="0,00" inputMode="decimal" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="occurredOn">Data</Label>
              <Input id="occurredOn" name="occurredOn" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            </div>
            <div>
              <Label htmlFor="accountId">Conta (opcional)</Label>
              <Select id="accountId" name="accountId" defaultValue="">
                <option value="">—</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Input id="notes" name="notes" />
          </div>
          <SubmitButton className="w-full">Registrar</SubmitButton>
        </form>
      </Card>

      <div className="space-y-2">
        {movements.length === 0 && <p className="text-sm text-slate-400">Nenhum aporte ou resgate registrado ainda.</p>}
        {movements.map((m) => (
          <Card key={m.id} className="flex items-center justify-between p-3">
            <div>
              <p className="text-sm font-medium text-slate-900">{m.type === 'CONTRIBUTION' ? 'Aporte' : 'Resgate'}</p>
              <p className="text-xs text-slate-500">{formatDate(m.occurredOn)}</p>
              {m.notes && <p className="text-xs text-slate-400">{m.notes}</p>}
            </div>
            <div className="flex items-center gap-3">
              <span className={m.type === 'CONTRIBUTION' ? 'font-semibold text-income' : 'font-semibold text-expense'}>
                {m.type === 'CONTRIBUTION' ? '+' : '-'}
                {formatCentsToBRL(m.amountCents)}
              </span>
              <form action={deleteInvestmentMovement.bind(null, investment.id, m.id)}>
                <ConfirmSubmitButton confirmMessage="Excluir este movimento?">Excluir</ConfirmSubmitButton>
              </form>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
