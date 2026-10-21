'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireCurrentUser } from '@/lib/session';
import { parseBRLToCents } from '@/lib/format';
import * as accountsDb from '@/lib/firestore/accounts';

const accountSchema = z.object({
  name: z.string().trim().min(1, 'Informe um nome.'),
  type: z.enum(['CHECKING', 'SAVINGS', 'CASH']),
  institution: z.string().trim().optional(),
  openingBalance: z.string().optional(),
});

export async function createAccount(formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = accountSchema.parse(Object.fromEntries(formData));

  await accountsDb.createAccount(user.householdId, {
    name: parsed.name,
    type: parsed.type,
    institution: parsed.institution || null,
    openingBalanceCents: parseBRLToCents(parsed.openingBalance ?? '0'),
  });

  revalidatePath('/accounts');
  redirect('/accounts');
}

export async function updateAccount(id: string, formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = accountSchema.parse(Object.fromEntries(formData));

  await accountsDb.updateAccount(user.householdId, id, {
    name: parsed.name,
    type: parsed.type,
    institution: parsed.institution || null,
    openingBalanceCents: parseBRLToCents(parsed.openingBalance ?? '0'),
  });

  revalidatePath('/accounts');
  redirect('/accounts');
}

export async function archiveAccount(id: string) {
  const user = await requireCurrentUser();
  await accountsDb.archiveAccount(user.householdId, id);
  revalidatePath('/accounts');
}
