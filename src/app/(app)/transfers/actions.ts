'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCurrentUser } from '@/lib/session';
import { parseBRLToCents } from '@/lib/format';

const transferSchema = z
  .object({
    fromAccountId: z.string().min(1, 'Selecione a conta de origem.'),
    toAccountId: z.string().min(1, 'Selecione a conta de destino.'),
    amount: z.string().min(1, 'Informe o valor.'),
    occurredOn: z.string().min(1, 'Informe a data.'),
    notes: z.string().trim().optional(),
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message: 'A conta de origem e destino devem ser diferentes.',
    path: ['toAccountId'],
  });

export async function createTransfer(formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = transferSchema.parse(Object.fromEntries(formData));
  const supabase = createClient();

  const { error } = await supabase.from('transfers').insert({
    household_id: user.householdId,
    from_account_id: parsed.fromAccountId,
    to_account_id: parsed.toAccountId,
    amount_cents: parseBRLToCents(parsed.amount),
    occurred_on: parsed.occurredOn,
    notes: parsed.notes || null,
  });

  if (error) throw new Error('Não foi possível registrar a transferência.');

  revalidatePath('/transfers');
}

export async function deleteTransfer(id: string) {
  await requireCurrentUser();
  const supabase = createClient();
  await supabase.from('transfers').update({ deleted_at: new Date().toISOString() }).eq('id', id);
  revalidatePath('/transfers');
}
