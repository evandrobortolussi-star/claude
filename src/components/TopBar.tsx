'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function TopBar({ householdName }: { householdName: string }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="safe-top sticky top-0 z-10 border-b border-slate-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3 md:max-w-2xl lg:max-w-3xl">
        <div>
          <p className="text-xs text-slate-400">Financeiro Familiar</p>
          <p className="text-sm font-semibold text-slate-900">{householdName}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
        >
          Sair
        </button>
      </div>
    </header>
  );
}
