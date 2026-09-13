'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

/**
 * Default error boundary for any page under the app shell. Route segments
 * that need bespoke wording (e.g. /dashboard) provide their own error.tsx,
 * which Next.js prefers over this shared fallback.
 */
export function GenericError({ reset }: { reset: () => void }) {
  return (
    <Card className="mt-6 text-center">
      <p className="text-2xl">😕</p>
      <p className="mt-2 text-sm font-medium text-slate-900">Algo deu errado ao carregar esta tela.</p>
      <p className="mt-1 text-sm text-slate-500">Verifique sua conexão e tente novamente.</p>
      <Button onClick={reset} className="mt-4">
        Tentar de novo
      </Button>
    </Card>
  );
}
