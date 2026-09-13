import { requireCurrentUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { formatCentsToBRL, formatDate } from '@/lib/format';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Input';
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton';
import { createTransfer, deleteTransfer } from './actions';

export default async function TransfersPage() {
  const user = await requireCurrentUser();
  const supabase = createClient();

  const [{ data: accounts }, { data: transfers }] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, name')
      .eq('household_id', user.householdId)
      .eq('archived', false)
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('transfers')
      .select('id, from_account_id, to_account_id, amount_cents, occurred_on, notes')
      .eq('household_id', user.householdId)
      .is('deleted_at', null)
      .order('occurred_on', { ascending: false }),
  ]);

  const accountNameById = new Map((accounts ?? []).map((a) => [a.id, a.name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Transferências</h1>
        <p className="text-sm text-slate-500">
          Movimentar dinheiro entre contas próprias — nunca conta como receita ou despesa.
        </p>
      </div>

      <Card>
        <CardTitle className="mb-3">Nova transferência</CardTitle>
        <form action={createTransfer} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fromAccountId">De</Label>
              <Select id="fromAccountId" name="fromAccountId" required defaultValue="">
                <option value="" disabled>
                  Selecione
                </option>
                {accounts?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="toAccountId">Para</Label>
              <Select id="toAccountId" name="toAccountId" required defaultValue="">
                <option value="" disabled>
                  Selecione
                </option>
                {accounts?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="amount">Valor</Label>
              <Input id="amount" name="amount" placeholder="0,00" inputMode="decimal" required />
            </div>
            <div>
              <Label htmlFor="occurredOn">Data</Label>
              <Input id="occurredOn" name="occurredOn" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            </div>
          </div>
          <div>
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Input id="notes" name="notes" />
          </div>
          <Button type="submit" className="w-full">
            Transferir
          </Button>
        </form>
      </Card>

      <div className="space-y-2">
        {(!transfers || transfers.length === 0) && (
          <p className="text-sm text-slate-400">Nenhuma transferência registrada ainda.</p>
        )}
        {transfers?.map((t) => (
          <Card key={t.id} className="flex items-center justify-between p-3">
            <div>
              <p className="text-sm font-medium text-slate-900">
                {accountNameById.get(t.from_account_id) ?? '—'} → {accountNameById.get(t.to_account_id) ?? '—'}
              </p>
              <p className="text-xs text-slate-500">{formatDate(t.occurred_on)}</p>
              {t.notes && <p className="text-xs text-slate-400">{t.notes}</p>}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-900">{formatCentsToBRL(t.amount_cents)}</span>
              <form action={deleteTransfer.bind(null, t.id)}>
                <ConfirmSubmitButton confirmMessage="Excluir esta transferência?">Excluir</ConfirmSubmitButton>
              </form>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
