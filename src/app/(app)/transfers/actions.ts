'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCurrentUser } from '@/lib/session';
import { parseBRLToCents } from '@/lib/format';
import * as transfersDb from '@/lib/firestore/transfers';

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

  await transfersDb.createTransfer(user.householdId, user.id, {
    fromAccountId: parsed.fromAccountId,
    toAccountId: parsed.toAccountId,
    amountCents: parseBRLToCents(parsed.amount),
    occurredOn: parsed.occurredOn,
    notes: parsed.notes || null,
  });

  revalidatePath('/transfers');
}

export async function deleteTransfer(id: string) {
  const user = await requireCurrentUser();
  await transfersDb.softDeleteTransfer(user.householdId, id);
  revalidatePath('/transfers');
}
