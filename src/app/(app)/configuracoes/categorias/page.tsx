import { createClient } from '@/lib/supabase/server';
import { requireCurrentUser } from '@/lib/session';
import { getCategoryOptions } from '@/lib/categories';
import { Card } from '@/components/ui/Card';

export default async function CategoriasPage() {
  await requireCurrentUser();
  const supabase = createClient();
  const categories = await getCategoryOptions(supabase);

  const groupsByKind = (kind: 'EXPENSE' | 'INCOME') => {
    const groups = new Map<string, string[]>();
    for (const c of categories) {
      if (c.kind !== kind) continue;
      const list = groups.get(c.groupName) ?? [];
      list.push(c.name);
      groups.set(c.groupName, list);
    }
    return Array.from(groups.entries());
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Categorias</h1>
        <p className="text-sm text-slate-500">
          Setores usados para classificar receitas e despesas — os mesmos para toda a família.
        </p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-slate-500">Despesas</h2>
        <div className="space-y-2">
          {groupsByKind('EXPENSE').map(([groupName, names]) => (
            <Card key={groupName}>
              <p className="text-sm font-medium text-slate-900">{groupName}</p>
              <p className="mt-1 text-xs text-slate-500">{names.join(' · ')}</p>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-slate-500">Receitas</h2>
        <div className="space-y-2">
          {groupsByKind('INCOME').map(([groupName, names]) => (
            <Card key={groupName}>
              <p className="text-sm font-medium text-slate-900">{groupName}</p>
              <p className="mt-1 text-xs text-slate-500">{names.join(' · ')}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
