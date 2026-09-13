import Link from 'next/link';
import { requireCurrentUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { formatCentsToBRL } from '@/lib/format';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Input';
import { createAccount, archiveAccount } from './actions';
import { ACCOUNT_TYPE_LABEL as TYPE_LABEL } from '@/lib/labels';

export default async function AccountsPage() {
  const user = await requireCurrentUser();
  const supabase = createClient();
  const { data: accounts } = await supabase
    .from('accounts')
    .select('id, name, type, institution, opening_balance_cents')
    .eq('household_id', user.householdId)
    .eq('archived', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Contas e dinheiro</h1>
        <p className="text-sm text-slate-500">Contas correntes, poupanças e dinheiro em espécie.</p>
      </div>

      <Card>
        <CardTitle className="mb-3">Nova conta</CardTitle>
        <form action={createAccount} className="space-y-3">
          <div>
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" placeholder="Ex: Conta Corrente Itaú" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="type">Tipo</Label>
              <Select id="type" name="type" defaultValue="CHECKING">
                {Object.entries(TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="openingBalance">Saldo inicial</Label>
              <Input id="openingBalance" name="openingBalance" placeholder="0,00" inputMode="decimal" />
            </div>
          </div>
          <div>
            <Label htmlFor="institution">Instituição (opcional)</Label>
            <Input id="institution" name="institution" placeholder="Ex: Itaú" />
          </div>
          <Button type="submit" className="w-full">
            Adicionar conta
          </Button>
        </form>
      </Card>

      <div className="space-y-3">
        {(!accounts || accounts.length === 0) && (
          <p className="text-sm text-slate-400">Nenhuma conta cadastrada ainda.</p>
        )}
        {accounts?.map((account) => (
          <Card key={account.id} className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">{account.name}</p>
              <p className="text-xs text-slate-500">
                {TYPE_LABEL[account.type]} {account.institution ? `· ${account.institution}` : ''}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Saldo inicial: {formatCentsToBRL(account.opening_balance_cents)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Link href={`/accounts/${account.id}/edit`} className="text-xs font-medium text-brand-600">
                Editar
              </Link>
              <form action={archiveAccount.bind(null, account.id)}>
                <button type="submit" className="text-xs font-medium text-slate-400 hover:text-red-500">
                  Arquivar
                </button>
              </form>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
