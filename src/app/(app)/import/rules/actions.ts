'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCurrentUser } from '@/lib/session';
import { normalizeDescription } from '@/lib/normalize';

const ruleSchema = z.object({
  pattern: z.string().trim().min(2, 'O padrão precisa ter pelo menos 2 letras.'),
  categoryId: z.string().min(1, 'Selecione uma categoria.'),
  scope: z.enum(['FAMILY', 'SPOUSE_1', 'SPOUSE_2']),
});

export async function updateRule(id: string, formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = ruleSchema.parse(Object.fromEntries(formData));
  const supabase = createClient();

  const { error } = await supabase
    .from('classification_rules')
    .update({
      pattern: normalizeDescription(parsed.pattern),
      category_id: parsed.categoryId,
      scope: parsed.scope,
    })
    .eq('id', id)
    .eq('household_id', user.householdId);

  if (error) throw new Error('Não foi possível salvar a regra.');

  revalidatePath('/import/rules');
}

export async function deactivateRule(id: string) {
  const user = await requireCurrentUser();
  const supabase = createClient();
  await supabase
    .from('classification_rules')
    .update({ active: false, deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('household_id', user.householdId);

  revalidatePath('/import/rules');
}
