import { notFound } from 'next/navigation';
import { requireCurrentUser } from '@/lib/session';
import { getCard } from '@/lib/firestore/cards';
import { formatCentsToBRL } from '@/lib/format';
import { Card, CardTitle } from '@/components/ui/Card';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { Input, Label } from '@/components/ui/Input';
import { updateCard } from '../../actions';

export default async function EditCardPage({ params }: { params: { id: string } }) {
  const user = await requireCurrentUser();
  const card = await getCard(user.householdId, params.id);

  if (!card) notFound();

  const updateWithId = updateCard.bind(null, card.id);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Editar cartão</h1>
      <Card>
        <CardTitle className="mb-3">Dados do cartão</CardTitle>
        <form action={updateWithId} className="space-y-3">
          <div>
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" defaultValue={card.name} required />
          </div>
          <div>
            <Label htmlFor="brand">Bandeira</Label>
            <Input id="brand" name="brand" defaultValue={card.brand ?? ''} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="closingDay">Dia de fechamento</Label>
              <Input id="closingDay" name="closingDay" type="number" min={1} max={31} defaultValue={card.closingDay} required />
            </div>
            <div>
              <Label htmlFor="dueDay">Dia de vencimento</Label>
              <Input id="dueDay" name="dueDay" type="number" min={1} max={31} defaultValue={card.dueDay} required />
            </div>
          </div>
          <div>
            <Label htmlFor="limit">Limite</Label>
            <Input
              id="limit"
              name="limit"
              defaultValue={card.limitCents != null ? formatCentsToBRL(card.limitCents) : ''}
              inputMode="decimal"
            />
          </div>
          <SubmitButton className="w-full">Salvar alterações</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
