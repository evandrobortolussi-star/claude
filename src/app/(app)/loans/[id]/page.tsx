import { notFound } from 'next/navigation';
import { requireCurrentUser } from '@/lib/session';
import { getLoan, listLoanPayments } from '@/lib/firestore/loans';
import { listActiveAccounts } from '@/lib/firestore/accounts';
import { formatCentsToBRL, formatDate } from '@/lib/format';
import { Card, CardTitle } from '@/components/ui/Card';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { Input, Label, Select } from '@/components/ui/Input';
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton';
import { createLoanPayment, deleteLoanPayment } from '../actions';

export default async function LoanDetailPage({ params }: { params: { id: string } }) {
  const user = await requireCurrentUser();

  const loan = await getLoan(user.householdId, params.id);
  if (!loan) notFound();

  const [payments, accounts] = await Promise.all([
    listLoanPayments(user.householdId, params.id),
    listActiveAccounts(user.householdId),
  ]);

  const addPayment = createLoanPayment.bind(null, loan.id);
  const progressPct = Math.min(100, Math.round((loan.installmentsPaid / loan.installmentsTotal) * 100));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{loan.name}</h1>
        <p className="text-sm text-slate-500">
          {loan.kind === 'LOAN' ? 'Empréstimo' : 'Financiamento'} · {loan.institution}
        </p>
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-slate-500">Saldo devedor</p>
            <p className="font-semibold text-expense">{formatCentsToBRL(loan.outstandingBalanceCents)}</p>
          </div>
          <div>
            <p className="text-slate-500">Valor contratado</p>
            <p className="font-medium text-slate-900">{formatCentsToBRL(loan.contractedAmountCents)}</p>
          </div>
          <div>
            <p className="text-slate-500">Parcela</p>
            <p className="font-medium text-slate-900">{formatCentsToBRL(loan.installmentAmountCents)}</p>
          </div>
          <div>
            <p className="text-slate-500">Parcelas pagas</p>
            <p className="font-medium text-slate-900">
              {loan.installmentsPaid}/{loan.installmentsTotal}
            </p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${progressPct}%` }} />
        </div>
      </Card>

      <Card>
        <CardTitle className="mb-3">Registrar pagamento</CardTitle>
        <form action={addPayment} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="amount">Valor</Label>
              <Input
                id="amount"
                name="amount"
                placeholder="0,00"
                inputMode="decimal"
                defaultValue={formatCentsToBRL(loan.installmentAmountCents)}
                required
              />
            </div>
            <div>
              <Label htmlFor="occurredOn">Data</Label>
              <Input id="occurredOn" name="occurredOn" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            </div>
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
          <div>
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Input id="notes" name="notes" />
          </div>
          <SubmitButton className="w-full">Registrar pagamento</SubmitButton>
        </form>
      </Card>

      <div className="space-y-2">
        {payments.length === 0 && <p className="text-sm text-slate-400">Nenhum pagamento registrado ainda.</p>}
        {payments.map((p) => (
          <Card key={p.id} className="flex items-center justify-between p-3">
            <div>
              <p className="text-sm font-medium text-slate-900">{formatDate(p.occurredOn)}</p>
              {p.notes && <p className="text-xs text-slate-400">{p.notes}</p>}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-expense">{formatCentsToBRL(p.amountCents)}</span>
              <form action={deleteLoanPayment.bind(null, loan.id, p.id)}>
                <ConfirmSubmitButton confirmMessage="Excluir este pagamento? O saldo devedor será restaurado.">
                  Excluir
                </ConfirmSubmitButton>
              </form>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
