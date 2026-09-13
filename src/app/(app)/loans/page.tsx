import Link from 'next/link';
import { requireCurrentUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { formatCentsToBRL } from '@/lib/format';
import { Card, CardTitle } from '@/components/ui/Card';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { Input, Label, Select } from '@/components/ui/Input';
import { createLoan, archiveLoan } from './actions';

export default async function LoansPage() {
  const user = await requireCurrentUser();
  const supabase = createClient();
  const { data: loans } = await supabase
    .from('loans')
    .select(
      'id, kind, name, institution, outstanding_balance_cents, contracted_amount_cents, installments_total, installments_paid',
    )
    .eq('household_id', user.householdId)
    .eq('archived', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  const totalOutstanding = (loans ?? []).reduce((s, l) => s + l.outstanding_balance_cents, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Empréstimos e financiamentos</h1>
        <p className="text-sm text-slate-500">Acompanhe o saldo devedor de cada dívida.</p>
      </div>

      <Card className="text-center">
        <p className="text-xs text-slate-500">Saldo devedor total</p>
        <p className="mt-1 text-lg font-semibold text-expense">{formatCentsToBRL(totalOutstanding)}</p>
      </Card>

      <Card>
        <CardTitle className="mb-3">Novo empréstimo/financiamento</CardTitle>
        <form action={createLoan} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="kind">Tipo</Label>
              <Select id="kind" name="kind" defaultValue="LOAN">
                <option value="LOAN">Empréstimo</option>
                <option value="FINANCING">Financiamento</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" placeholder="Ex: Financiamento do carro" required />
            </div>
          </div>
          <div>
            <Label htmlFor="institution">Instituição (opcional)</Label>
            <Input id="institution" name="institution" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="contractedAmount">Valor contratado</Label>
              <Input id="contractedAmount" name="contractedAmount" placeholder="0,00" inputMode="decimal" required />
            </div>
            <div>
              <Label htmlFor="installmentAmount">Valor da parcela</Label>
              <Input id="installmentAmount" name="installmentAmount" placeholder="0,00" inputMode="decimal" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="installmentsTotal">Nº de parcelas</Label>
              <Input id="installmentsTotal" name="installmentsTotal" type="number" min={1} required />
            </div>
            <div>
              <Label htmlFor="interestRateMonthly">Juros a.m. % (opcional)</Label>
              <Input id="interestRateMonthly" name="interestRateMonthly" placeholder="Ex: 1,5" inputMode="decimal" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="dueDay">Dia de vencimento (opcional)</Label>
              <Input id="dueDay" name="dueDay" type="number" min={1} max={31} />
            </div>
            <div>
              <Label htmlFor="contractedOn">Data da contratação</Label>
              <Input id="contractedOn" name="contractedOn" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            </div>
          </div>
          <SubmitButton className="w-full">Adicionar</SubmitButton>
        </form>
      </Card>

      <div className="space-y-3">
        {(!loans || loans.length === 0) && <p className="text-sm text-slate-400">Nenhum empréstimo cadastrado ainda.</p>}
        {loans?.map((loan) => (
          <Card key={loan.id} className="flex items-center justify-between">
            <Link href={`/loans/${loan.id}`} className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{loan.name}</p>
              <p className="text-xs text-slate-500">
                {loan.kind === 'LOAN' ? 'Empréstimo' : 'Financiamento'} · {loan.institution}
              </p>
              <p className="text-xs text-slate-400">
                {loan.installments_paid}/{loan.installments_total} parcelas pagas
              </p>
              <p className="mt-1 text-sm font-semibold text-expense">{formatCentsToBRL(loan.outstanding_balance_cents)}</p>
            </Link>
            <form action={archiveLoan.bind(null, loan.id)}>
              <button type="submit" className="text-xs font-medium text-slate-400 hover:text-red-500">
                Arquivar
              </button>
            </form>
          </Card>
        ))}
      </div>
    </div>
  );
}
