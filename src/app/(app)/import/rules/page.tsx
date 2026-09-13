import { requireCurrentUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { getCategoryOptions } from '@/lib/categories';
import { Card } from '@/components/ui/Card';
import { Input, Label, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ConfirmSubmitButton } from '@/components/ui/ConfirmSubmitButton';
import { updateRule, deactivateRule } from './actions';
import { SCOPE_LABEL } from '@/lib/labels';

export default async function ClassificationRulesPage() {
  const user = await requireCurrentUser();
  const supabase = createClient();

  const [{ data: rules }, categories] = await Promise.all([
    supabase
      .from('classification_rules')
      .select('id, pattern, category_id, scope, match_count')
      .eq('household_id', user.householdId)
      .eq('active', true)
      .is('deleted_at', null)
      .order('match_count', { ascending: false }),
    getCategoryOptions(supabase),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Regras de classificação</h1>
        <p className="text-sm text-slate-500">
          Aprendidas a partir das movimentações que você já classificou. Editar ou excluir uma regra não muda
          lançamentos já confirmados — só afeta futuras importações.
        </p>
      </div>

      <div className="space-y-3">
        {(!rules || rules.length === 0) && (
          <p className="text-sm text-slate-400">Nenhuma regra ainda — elas são criadas ao confirmar uma importação.</p>
        )}
        {rules?.map((rule) => {
          const updateWithId = updateRule.bind(null, rule.id);
          const category = categories.find((c) => c.id === rule.category_id);
          return (
            <Card key={rule.id}>
              <form action={updateWithId} className="space-y-2">
                <div>
                  <Label htmlFor={`pattern-${rule.id}`}>Quando a descrição contém</Label>
                  <Input id={`pattern-${rule.id}`} name="pattern" defaultValue={rule.pattern} required />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor={`category-${rule.id}`}>Categoria</Label>
                    <Select id={`category-${rule.id}`} name="categoryId" defaultValue={rule.category_id}>
                      {categories
                        .filter((c) => c.kind === category?.kind)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`scope-${rule.id}`}>Responsável</Label>
                    <Select id={`scope-${rule.id}`} name="scope" defaultValue={rule.scope}>
                      {Object.entries(SCOPE_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-slate-400">Usada {rule.match_count} vez(es) em sugestões.</p>
                <div className="flex items-center gap-3 pt-1">
                  <Button type="submit" variant="secondary" className="flex-1">
                    Salvar
                  </Button>
                </div>
              </form>
              <form action={deactivateRule.bind(null, rule.id)} className="mt-2 text-center">
                <ConfirmSubmitButton confirmMessage="Excluir esta regra? Ela para de sugerir, mas nada já classificado muda.">
                  Excluir regra
                </ConfirmSubmitButton>
              </form>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
