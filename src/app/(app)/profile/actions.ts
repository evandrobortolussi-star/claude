'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireCurrentUser } from '@/lib/session';
import { renameHousehold as renameHouseholdInFirestore, updateOwnProfile } from '@/lib/firestore/households';

export type FormActionState = { error?: string; success?: boolean };

const profileSchema = z.object({
  fullName: z.string().trim().min(2, 'Informe seu nome.'),
  avatarEmoji: z.string().trim().min(1).max(4),
});

export async function updateProfile(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const user = await requireCurrentUser();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  try {
    await updateOwnProfile(user.id, parsed.data);
  } catch {
    return { error: 'Não foi possível salvar. Tente novamente.' };
  }

  revalidatePath('/profile');
  return { success: true };
}

const householdSchema = z.object({
  name: z.string().trim().min(2, 'Dê um nome para a família.'),
});

export async function renameHousehold(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const user = await requireCurrentUser();
  const parsed = householdSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dados inválidos.' };
  }

  const { ok } = await renameHouseholdInFirestore(user.id, user.householdId, parsed.data.name);
  if (!ok) {
    return { error: 'Apenas o titular da família pode renomeá-la.' };
  }

  revalidatePath('/profile');
  revalidatePath('/configuracoes/casal');
  return { success: true };
}
