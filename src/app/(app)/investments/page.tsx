import Link from 'next/link';
import { requireCurrentUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { formatCentsToBRL } from '@/lib/format';
import { Card, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Input';
import { createInvestment, archiveInvestment } from './actions';

const TYPE_LABEL: Record<string, string> = {
  RENDA_FIXA: 'Renda fixa',
  RENDA_VARIAVEL: 'Renda variável',
  FUNDO: 'Fundo',
  PREVIDENCIA: 'Previdência',
  CRIPTO: 'Cripto',
  OUTRO: 'Outro',
};

export default async function InvestmentsPage() {
  const user = await requireCurrentUser();
  const supabase = createClient();

  const [{ data: investments }, { data: movements }] = await Promise.all([
    supabase
      .from('investments')
      .select('id, name, type, institution')
      .eq('household_id', user.householdId)
      .eq('archived', false)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    supabase
      .from('investment_movements')
      .select('investment_id, type, amount_cents')
      .eq('household_id', user.householdId)
      .is('deleted_at', null),
  ]);

  const balanceByInvestment = new Map<string, number>();
  for (const m of movements ?? []) {
    const delta = m.type === 'CONTRIBUTION' ? m.amount_cents : -m.amount_cents;
    balanceByInvestment.set(m.investment_id, (balanceByInvestment.get(m.investment_id) ?? 0) + delta);
  }
  const totalInvested = Array.from(balanceByInvestment.values()).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Investimentos</h1>
        <p className="text-sm text-slate-500">Onde o patrimônio do casal está aplicado.</p>
      </div>

      <Card className="text-center">
        <p className="text-xs text-slate-500">Total investido</p>
        <p className="mt-1 text-lg font-semibold text-slate-900">{formatCentsToBRL(totalInvested)}</p>
      </Card>

      <Card>
        <CardTitle className="mb-3">Novo investimento</CardTitle>
        <form action={createInvestment} className="space-y-3">
          <div>
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" placeholder="Ex: Tesouro Selic" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="type">Tipo</Label>
              <Select id="type" name="type" defaultValue="RENDA_FIXA">
                {Object.entries(TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="institution">Instituição</Label>
              <Input id="institution" name="institution" placeholder="Ex: XP" />
            </div>
          </div>
          <Button type="submit" className="w-full">
            Adicionar investimento
          </Button>
        </form>
      </Card>

      <div className="space-y-3">
        {(!investments || investments.length === 0) && (
          <p className="text-sm text-slate-400">Nenhum investimento cadastrado ainda.</p>
        )}
        {investments?.map((investment) => (
          <Card key={investment.id} className="flex items-center justify-between">
            <Link href={`/investments/${investment.id}`} className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{investment.name}</p>
              <p className="text-xs text-slate-500">
                {TYPE_LABEL[investment.type]} {investment.institution ? `· ${investment.institution}` : ''}
              </p>
              <p className="mt-1 text-sm font-medium text-brand-700">
                {formatCentsToBRL(balanceByInvestment.get(investment.id) ?? 0)}
              </p>
            </Link>
            <form action={archiveInvestment.bind(null, investment.id)}>
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
