'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCurrentUser } from '@/lib/session';
import { normalizeDescription } from '@/lib/normalize';
import * as rulesDb from '@/lib/firestore/classificationRules';

const ruleSchema = z.object({
  pattern: z.string().trim().min(2, 'O padrão precisa ter pelo menos 2 letras.'),
  categoryId: z.string().min(1, 'Selecione uma categoria.'),
  scope: z.enum(['FAMILY', 'SPOUSE_1', 'SPOUSE_2']),
});

export async function updateRule(id: string, formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = ruleSchema.parse(Object.fromEntries(formData));

  await rulesDb.updateRule(user.householdId, id, {
    pattern: normalizeDescription(parsed.pattern),
    categoryId: parsed.categoryId,
    scope: parsed.scope,
  });

  revalidatePath('/import/rules');
}

export async function deactivateRule(id: string) {
  const user = await requireCurrentUser();
  await rulesDb.deactivateRule(user.householdId, id);
  revalidatePath('/import/rules');
}
