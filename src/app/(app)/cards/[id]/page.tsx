import { notFound } from 'next/navigation';
import { requireCurrentUser } from '@/lib/session';
import { getCard, listCardPayments, listCardPurchases } from '@/lib/firestore/cards';
import { listActiveAccounts } from '@/lib/firestore/accounts';
import { formatCentsToBRL, formatDate, cardInvoiceMonth } from '@/lib/format';
import { Card, CardTitle } from '@/components/ui/Card';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { Input, Label, Select } from '@/components/ui/Input';
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton';
import { createCardPayment, deleteCardPayment } from '../actions';

function monthLabel(firstOfMonthISO: string) {
  const [year, month] = firstOfMonthISO.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export default async function CardDetailPage({ params }: { params: { id: string } }) {
  const user = await requireCurrentUser();

  const card = await getCard(user.householdId, params.id);
  if (!card) notFound();

  const [purchases, payments, accounts] = await Promise.all([
    listCardPurchases(user.householdId, params.id),
    listCardPayments(user.householdId, params.id),
    listActiveAccounts(user.householdId),
  ]);

  type Purchase = (typeof purchases)[number];
  const invoiceGroups = new Map<string, { total: number; items: Purchase[] }>();
  for (const purchase of purchases) {
    const invoice = cardInvoiceMonth(purchase.occurredOn, card.closingDay);
    const group = invoiceGroups.get(invoice) ?? { total: 0, items: [] };
    group.total += purchase.amountCents;
    group.items.push(purchase);
    invoiceGroups.set(invoice, group);
  }
  const sortedInvoices = Array.from(invoiceGroups.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));

  const addPayment = createCardPayment.bind(null, card.id);
  const currentMonthValue = new Date().toISOString().slice(0, 7);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{card.name}</h1>
        <p className="text-sm text-slate-500">
          {card.brand ? `${card.brand} · ` : ''}Fecha dia {card.closingDay}, vence dia {card.dueDay}
          {card.limitCents != null ? ` · Limite ${formatCentsToBRL(card.limitCents)}` : ''}
        </p>
      </div>

      <Card>
        <CardTitle className="mb-3">Pagar fatura</CardTitle>
        <form action={addPayment} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="invoiceMonth">Mês da fatura</Label>
              <Input id="invoiceMonth" name="invoiceMonth" type="month" defaultValue={currentMonthValue} required />
            </div>
            <div>
              <Label htmlFor="amount">Valor pago</Label>
              <Input id="amount" name="amount" placeholder="0,00" inputMode="decimal" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="occurredOn">Data do pagamento</Label>
              <Input id="occurredOn" name="occurredOn" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
            </div>
            <div>
              <Label htmlFor="accountId">Conta usada</Label>
              <Select id="accountId" name="accountId" required defaultValue="">
                <option value="" disabled>
                  Selecione
                </option>
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
          <SubmitButton className="w-full">Registrar pagamento</SubmitButton>
        </form>
        <p className="mt-2 text-xs text-slate-400">
          Pagar a fatura não cria uma nova despesa — as compras já foram registradas quando aconteceram.
        </p>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-medium text-slate-500">Faturas</h2>
        <div className="space-y-3">
          {sortedInvoices.length === 0 && <p className="text-sm text-slate-400">Nenhuma compra neste cartão ainda.</p>}
          {sortedInvoices.map(([invoice, group]) => (
            <Card key={invoice}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium capitalize text-slate-900">{monthLabel(invoice)}</p>
                <p className="font-semibold text-expense">{formatCentsToBRL(group.total)}</p>
              </div>
              <ul className="mt-2 space-y-1">
                {group.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {item.description}
                      {item.installmentTotal ? ` (${item.installmentNumber}/${item.installmentTotal})` : ''}
                    </span>
                    <span>{formatCentsToBRL(item.amountCents)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-slate-500">Pagamentos registrados</h2>
        <div className="space-y-2">
          {payments.length === 0 && <p className="text-sm text-slate-400">Nenhum pagamento registrado ainda.</p>}
          {payments.map((p) => (
            <Card key={p.id} className="flex items-center justify-between p-3">
              <div>
                <p className="text-sm font-medium capitalize text-slate-900">{monthLabel(p.invoiceMonth)}</p>
                <p className="text-xs text-slate-500">Pago em {formatDate(p.occurredOn)}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-900">{formatCentsToBRL(p.amountCents)}</span>
                <form action={deleteCardPayment.bind(null, card.id, p.id)}>
                  <ConfirmSubmitButton confirmMessage="Excluir este pagamento?">Excluir</ConfirmSubmitButton>
                </form>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
