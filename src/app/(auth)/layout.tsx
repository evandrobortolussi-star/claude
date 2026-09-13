import { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-2xl">
            💰
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Financeiro Familiar</h1>
          <p className="mt-1 text-sm text-slate-500">Controle financeiro do casal, num só lugar.</p>
        </div>
        {children}
      </div>
    </div>
  );
}
