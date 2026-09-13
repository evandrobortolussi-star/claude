'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireCurrentUser } from '@/lib/session';

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

  const supabase = createClient();
  // RLS ("a user can update their own profile") + a column grant restrict
  // this to full_name/avatar_emoji on the caller's own row — the id in the
  // filter is only for clarity, the database is what actually enforces it.
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data.fullName, avatar_emoji: parsed.data.avatarEmoji })
    .eq('id', user.id);

  if (error) {
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

  const supabase = createClient();
  // Only the OWNER's request will actually match the "owner can rename
  // their household" RLS policy — a MEMBER's update simply affects 0 rows.
  const { error, count } = await supabase
    .from('households')
    .update({ name: parsed.data.name }, { count: 'exact' })
    .eq('id', user.householdId);

  if (error) {
    return { error: 'Não foi possível salvar. Tente novamente.' };
  }
  if (!count) {
    return { error: 'Apenas o titular da família pode renomeá-la.' };
  }

  revalidatePath('/profile');
  return { success: true };
}
