'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireCurrentUser } from '@/lib/session';
import { parseBRLToCents } from '@/lib/format';
import * as investmentsDb from '@/lib/firestore/investments';

const investmentSchema = z.object({
  name: z.string().trim().min(1, 'Informe um nome.'),
  type: z.enum(['RENDA_FIXA', 'RENDA_VARIAVEL', 'FUNDO', 'PREVIDENCIA', 'CRIPTO', 'OUTRO']),
  institution: z.string().trim().optional(),
});

export async function createInvestment(formData: FormData) {
  const user = await requireCurrentUser();
  const parsed = investmentSchema.parse(Object.fromEntries(formData));

  await investmentsDb.createInvestment(user.householdId, {
    name: parsed.name,
    type: parsed.type,
    institution: parsed.institution || null,
  });

  revalidatePath('/investments');
  redirect('/investments');
}

export async function archiveInvestment(id: string) {
  const user = await requireCurrentUser();
  await investmentsDb.archiveInvestment(user.householdId, id);
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

  await investmentsDb.createInvestmentMovement(user.householdId, user.id, investmentId, {
    type: parsed.type,
    amountCents: parseBRLToCents(parsed.amount),
    occurredOn: parsed.occurredOn,
    accountId: parsed.accountId || null,
    notes: parsed.notes || null,
  });

  revalidatePath(`/investments/${investmentId}`);
  revalidatePath('/investments');
}

export async function deleteInvestmentMovement(investmentId: string, movementId: string) {
  const user = await requireCurrentUser();
  await investmentsDb.softDeleteInvestmentMovement(user.householdId, movementId);
  revalidatePath(`/investments/${investmentId}`);
  revalidatePath('/investments');
}
