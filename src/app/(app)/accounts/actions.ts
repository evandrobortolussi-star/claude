'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCurrentUser } from '@/lib/session';
import { parseBRLToCents } from '@/lib/format';

const accountSchema = z.object({
  name: z.string().trim().min(1, 'Informe um nome.'),
  type: z.enum(['CHECKING', 'SAVINGS', 'CASH']),
  institution: z.string().trim().optional(),
  openingBalance: z.string().optional(),
});

export async function createAccount(formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = accountSchema.parse(Object.fromEntries(formData));
  const supabase = createClient();

  const { error } = await supabase.from('accounts').insert({
    household_id: user.householdId,
    name: parsed.name,
    type: parsed.type,
    institution: parsed.institution || null,
    opening_balance_cents: parseBRLToCents(parsed.openingBalance ?? '0'),
  });

  if (error) throw new Error('Não foi possível criar a conta.');

  revalidatePath('/accounts');
  redirect('/accounts');
}

export async function updateAccount(id: string, formData: FormData) {
  await requireCurrentUser();
  const parsed = accountSchema.parse(Object.fromEntries(formData));
  const supabase = createClient();

  const { error } = await supabase
    .from('accounts')
    .update({
      name: parsed.name,
      type: parsed.type,
      institution: parsed.institution || null,
      opening_balance_cents: parseBRLToCents(parsed.openingBalance ?? '0'),
    })
    .eq('id', id);

  if (error) throw new Error('Não foi possível salvar a conta.');

  revalidatePath('/accounts');
  redirect('/accounts');
}

export async function archiveAccount(id: string) {
  await requireCurrentUser();
  const supabase = createClient();
  await supabase.from('accounts').update({ archived: true }).eq('id', id);
  revalidatePath('/accounts');
}
