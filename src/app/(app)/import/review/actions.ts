'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCurrentUser } from '@/lib/session';
import * as importDb from '@/lib/firestore/importBatches';
import { upsertClassificationRule } from '@/lib/firestore/classificationRules';
import { getStagedTransaction } from '@/lib/firestore/importBatches';

const confirmSchema = z.object({
  categoryId: z.string().min(1, 'Selecione uma categoria.'),
  scope: z.enum(['FAMILY', 'SPOUSE_1', 'SPOUSE_2']),
});

export async function confirmStagedTransaction(stagedId: string, formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = confirmSchema.parse(Object.fromEntries(formData));

  await importDb.confirmStagedTransaction(user.householdId, user.id, stagedId, parsed.categoryId, parsed.scope);

  // Learn from this classification for future imports — never touches any
  // transaction that already exists.
  const staged = await getStagedTransaction(user.householdId, stagedId);
  if (staged) {
    await upsertClassificationRule(user.householdId, user.id, staged.normalizedDescription, parsed.categoryId, parsed.scope);
  }

  revalidatePath('/import/review');
  revalidatePath('/import');
  revalidatePath('/transactions');
  revalidatePath('/dashboard');
}

export async function ignoreStagedTransaction(stagedId: string) {
  const user = await requireCurrentUser();
  await importDb.ignoreStagedTransaction(user.householdId, stagedId);

  revalidatePath('/import/review');
  revalidatePath('/import');
}
