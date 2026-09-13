import { ReactNode } from 'react';
import { requireCurrentUser } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/TopBar';
import { BottomNav } from '@/components/BottomNav';

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireCurrentUser();
  const supabase = createClient();
  const { data: household } = await supabase
    .from('households')
    .select('name')
    .eq('id', user.householdId)
    .single();

  return (
    <div className="min-h-dvh bg-slate-50">
      <TopBar householdName={household?.name ?? ''} />
      <main className="mx-auto max-w-lg px-4 pb-24 pt-4 md:max-w-2xl lg:max-w-3xl">{children}</main>
      <BottomNav />
    </div>
  );
}
