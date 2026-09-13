'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCurrentUser } from '@/lib/session';
import { parseBRLToCents } from '@/lib/format';

const investmentSchema = z.object({
  name: z.string().trim().min(1, 'Informe um nome.'),
  type: z.enum(['RENDA_FIXA', 'RENDA_VARIAVEL', 'FUNDO', 'PREVIDENCIA', 'CRIPTO', 'OUTRO']),
  institution: z.string().trim().optional(),
});

export async function createInvestment(formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = investmentSchema.parse(Object.fromEntries(formData));
  const supabase = createClient();

  const { error } = await supabase.from('investments').insert({
    household_id: user.householdId,
    name: parsed.name,
    type: parsed.type,
    institution: parsed.institution || null,
  });

  if (error) throw new Error('Não foi possível criar o investimento.');

  revalidatePath('/investments');
  redirect('/investments');
}

export async function archiveInvestment(id: string) {
  await requireCurrentUser();
  const supabase = createClient();
  await supabase.from('investments').update({ archived: true }).eq('id', id);
  revalidatePath('/investments');
}

const movementSchema = z.object({
  type: z.enum(['CONTRIBUTION', 'REDEMPTION']),
  amount: z.string().min(1, 'Informe o valor.'),
  occurredOn: z.string().min(1, 'Informe a data.'),
  accountId: z.string().optional(),
  notes: z.string().trim().optional(),
});

export async function createInvestmentMovement(investmentId: string, formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = movementSchema.parse(Object.fromEntries(formData));
  const supabase = createClient();

  const { error } = await supabase.from('investment_movements').insert({
    household_id: user.householdId,
    investment_id: investmentId,
    type: parsed.type,
    amount_cents: parseBRLToCents(parsed.amount),
    occurred_on: parsed.occurredOn,
    account_id: parsed.accountId || null,
    notes: parsed.notes || null,
  });

  if (error) throw new Error('Não foi possível registrar o movimento.');

  revalidatePath(`/investments/${investmentId}`);
  revalidatePath('/investments');
}

export async function deleteInvestmentMovement(investmentId: string, movementId: string) {
  await requireCurrentUser();
  const supabase = createClient();
  await supabase.from('investment_movements').update({ deleted_at: new Date().toISOString() }).eq('id', movementId);
  revalidatePath(`/investments/${investmentId}`);
  revalidatePath('/investments');
}
