import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type CurrentUser = {
  id: string;
  email: string | undefined;
  householdId: string;
  fullName: string;
  avatarEmoji: string;
  spouseSlot: 1 | 2;
  role: 'OWNER' | 'MEMBER';
};

/**
 * Fetches the current user's profile via a query scoped by RLS to
 * `id = auth.uid()` — the household id it returns comes from the database,
 * never from anything the client sent, so callers can trust it.
 */
export async function requireCurrentUser(): Promise<CurrentUser> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id, full_name, avatar_emoji, spouse_slot, role')
    .eq('id', user.id)
    .single();

  if (!profile) {
    // Auth user exists but sign-up trigger hasn't finished / failed.
    redirect('/login?error=profile_missing');
  }

  return {
    id: user.id,
    email: user.email,
    householdId: profile.household_id,
    fullName: profile.full_name,
    avatarEmoji: profile.avatar_emoji,
    spouseSlot: profile.spouse_slot,
    role: profile.role,
  };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id, full_name, avatar_emoji, spouse_slot, role')
    .eq('id', user.id)
    .single();

  if (!profile) return null;

  return {
    id: user.id,
    email: user.email,
    householdId: profile.household_id,
    fullName: profile.full_name,
    avatarEmoji: profile.avatar_emoji,
    spouseSlot: profile.spouse_slot,
    role: profile.role,
  };
}
