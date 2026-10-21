'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { Button } from '@/components/ui/Button';
import { Input, Label, FieldError } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get('oobCode');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);

    if (!oobCode) {
      setError('Link inválido ou expirado. Solicite um novo.');
      return;
    }

    setLoading(true);
    const password = String(new FormData(e.currentTarget).get('password'));

    try {
      await verifyPasswordResetCode(getFirebaseAuth(), oobCode);
      await confirmPasswordReset(getFirebaseAuth(), oobCode, password);
      setDone(true);
      setTimeout(() => router.push('/login'), 1500);
    } catch {
      setError('Não foi possível redefinir a senha. Solicite um novo link.');
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Card>
        <p className="text-center text-sm text-slate-600">Senha atualizada! Redirecionando para o login…</p>
      </Card>
    );
  }

  return (
    <Card>
      <p className="mb-4 text-sm text-slate-500">Escolha uma nova senha para sua conta.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="password">Nova senha</Label>
          <Input id="password" name="password" type="password" minLength={8} required />
        </div>
        <FieldError>{error}</FieldError>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Salvando…' : 'Redefinir senha'}
        </Button>
      </form>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
