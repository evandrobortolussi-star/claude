'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input, Label, FieldError } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';

export default function ForgotPasswordPage() {
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    setLoading(true);

    const email = String(new FormData(e.currentTarget).get('email'));
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/reset-password`,
    });

    setLoading(false);
    if (resetError) {
      setError('Não foi possível enviar o email. Tente novamente.');
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <Card>
        <p className="text-center text-sm text-slate-600">
          Se esse email existir, enviamos um link para redefinir sua senha.
        </p>
        <Link href="/login" className="mt-4 block text-center text-sm font-medium text-brand-600">
          Voltar ao login
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <p className="mb-4 text-sm text-slate-500">
        Informe seu email e enviaremos um link para você redefinir sua senha.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <FieldError>{error}</FieldError>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Enviando…' : 'Enviar link'}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        <Link href="/login" className="font-medium text-brand-600">
          Voltar ao login
        </Link>
      </p>
    </Card>
  );
}
