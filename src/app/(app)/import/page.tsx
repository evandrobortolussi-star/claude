import Link from 'next/link';
import { requireCurrentUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Label, Select } from '@/components/ui/Input';
import { importStatement } from './actions';

export default async function ImportPage() {
  const user = await requireCurrentUser();
  const supabase = createClient();

  const [{ data: accounts }, { data: cards }, { count: pendingCount }] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, name')
      .eq('household_id', user.householdId)
      .eq('archived', false)
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('credit_cards')
      .select('id, name')
      .eq('household_id', user.householdId)
      .eq('archived', false)
      .is('deleted_at', null)
      .order('name'),
    supabase
      .from('import_staged_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('household_id', user.householdId)
      .in('status', ['PENDING', 'SUGGESTED']),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Importar extrato</h1>
        <p className="text-sm text-slate-500">Arquivos CSV ou OFX do seu banco.</p>
      </div>

      {!!pendingCount && (
        <Link
          href="/import/review"
          className="block rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800"
        >
          {pendingCount} movimentação{pendingCount === 1 ? '' : 'ões'} aguardando revisão →
        </Link>
      )}

      <Card>
        <CardTitle className="mb-3">Novo arquivo</CardTitle>
        <form action={importStatement} className="space-y-3">
          <div>
            <Label htmlFor="destination">Lançar em</Label>
            <Select id="destination" name="destination" required defaultValue="">
              <option value="" disabled>
                Selecione a conta ou cartão
              </option>
              {accounts?.map((a) => (
                <option key={a.id} value={`account:${a.id}`}>
                  Conta: {a.name}
                </option>
              ))}
              {cards?.map((c) => (
                <option key={c.id} value={`card:${c.id}`}>
                  Cartão: {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="file">Arquivo (.csv, .ofx ou .qfx)</Label>
            <input
              id="file"
              name="file"
              type="file"
              accept=".csv,.txt,.ofx,.qfx"
              required
              className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm"
            />
          </div>
          <Button type="submit" className="w-full">
            Importar
          </Button>
        </form>
        <p className="mt-3 text-xs text-slate-400">
          Nada é lançado automaticamente: você revisa e confirma cada movimentação antes de virar um lançamento.
        </p>
      </Card>

      <Link href="/import/rules" className="block text-center text-sm font-medium text-brand-600">
        Gerenciar regras de classificação
      </Link>
    </div>
  );
}
