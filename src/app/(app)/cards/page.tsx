import Link from 'next/link';
import { requireCurrentUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { formatCentsToBRL } from '@/lib/format';
import { Card, CardTitle } from '@/components/ui/Card';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { Input, Label } from '@/components/ui/Input';
import { createCard, archiveCard } from './actions';

export default async function CardsPage() {
  const user = await requireCurrentUser();
  const supabase = createClient();
  const { data: cards } = await supabase
    .from('credit_cards')
    .select('id, name, brand, closing_day, due_day, limit_cents')
    .eq('household_id', user.householdId)
    .eq('archived', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Cartões de crédito</h1>
        <p className="text-sm text-slate-500">Limite, fechamento e vencimento de cada cartão.</p>
      </div>

      <Card>
        <CardTitle className="mb-3">Novo cartão</CardTitle>
        <form action={createCard} className="space-y-3">
          <div>
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" placeholder="Ex: Nubank Roxinho" required />
          </div>
          <div>
            <Label htmlFor="brand">Bandeira (opcional)</Label>
            <Input id="brand" name="brand" placeholder="Ex: Mastercard" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="closingDay">Dia de fechamento</Label>
              <Input id="closingDay" name="closingDay" type="number" min={1} max={31} required />
            </div>
            <div>
              <Label htmlFor="dueDay">Dia de vencimento</Label>
              <Input id="dueDay" name="dueDay" type="number" min={1} max={31} required />
            </div>
          </div>
          <div>
            <Label htmlFor="limit">Limite (opcional)</Label>
            <Input id="limit" name="limit" placeholder="0,00" inputMode="decimal" />
          </div>
          <SubmitButton className="w-full">Adicionar cartão</SubmitButton>
        </form>
      </Card>

      <div className="space-y-3">
        {(!cards || cards.length === 0) && <p className="text-sm text-slate-400">Nenhum cartão cadastrado ainda.</p>}
        {cards?.map((card) => (
          <Card key={card.id} className="flex items-center justify-between">
            <Link href={`/cards/${card.id}`} className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{card.name}</p>
              <p className="text-xs text-slate-500">
                {card.brand ? `${card.brand} · ` : ''}Fecha dia {card.closing_day}, vence dia {card.due_day}
              </p>
              {card.limit_cents != null && (
                <p className="mt-1 text-sm text-slate-600">Limite: {formatCentsToBRL(card.limit_cents)}</p>
              )}
            </Link>
            <div className="flex flex-col items-end gap-2">
              <Link href={`/cards/${card.id}/edit`} className="text-xs font-medium text-brand-600">
                Editar
              </Link>
              <form action={archiveCard.bind(null, card.id)}>
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
