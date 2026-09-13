'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card className="mt-6 text-center">
      <p className="text-2xl">😕</p>
      <p className="mt-2 text-sm font-medium text-slate-900">Não foi possível carregar sua visão financeira.</p>
      <p className="mt-1 text-sm text-slate-500">Verifique sua conexão e tente novamente.</p>
      <Button onClick={reset} className="mt-4">
        Tentar de novo
      </Button>
    </Card>
  );
}
