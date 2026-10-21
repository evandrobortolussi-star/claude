'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { Button } from '@/components/ui/Button';
import { Input, Label, FieldError } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

export default function RegisterPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get('email'));
    const password = String(formData.get('password'));
    const fullName = String(formData.get('name'));

    try {
      const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
      const idToken = await credential.user.getIdToken();

      const signupResponse = await fetch('/api/auth/complete-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'create'
            ? { idToken, mode: 'create', householdName: String(formData.get('householdName')), fullName }
            : { idToken, mode: 'join', inviteCode: String(formData.get('inviteCode')).toUpperCase(), fullName },
        ),
      });

      if (!signupResponse.ok) {
        const body = (await signupResponse.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? 'Não foi possível criar a conta.');
        await credential.user.delete().catch(() => {});
        setLoading(false);
        return;
      }

      await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(translateError(err instanceof Error ? err.message : ''));
      setLoading(false);
    }
  }

  return (
    <Card>
      <div className="mb-4 flex rounded-xl bg-slate-100 p-1 text-sm">
        <button
          type="button"
          onClick={() => setMode('create')}
          className={cn(
            'flex-1 rounded-lg py-2 font-medium transition-colors',
            mode === 'create' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500',
          )}
        >
          Criar família
        </button>
        <button
          type="button"
          onClick={() => setMode('join')}
          className={cn(
            'flex-1 rounded-lg py-2 font-medium transition-colors',
            mode === 'join' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500',
          )}
        >
          Já tenho convite
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'create' ? (
          <div>
            <Label htmlFor="householdName">Nome da família</Label>
            <Input id="householdName" name="householdName" placeholder="Ex: Família Silva" required />
          </div>
        ) : (
          <div>
            <Label htmlFor="inviteCode">Código de convite</Label>
            <Input id="inviteCode" name="inviteCode" placeholder="Ex: AB12CD34" required className="uppercase" />
          </div>
        )}
        <div>
          <Label htmlFor="name">Seu nome</Label>
          <Input id="name" name="name" required />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <Label htmlFor="password">Senha</Label>
          <Input id="password" name="password" type="password" minLength={8} required />
        </div>
        <FieldError>{error}</FieldError>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Enviando…' : mode === 'create' ? 'Criar família' : 'Entrar na família'}
        </Button>
      </form>

      {mode === 'create' && (
        <p className="mt-3 text-xs text-slate-400">
          Depois de criar, você recebe um código de convite para seu parceiro(a) entrar na mesma família.
        </p>
      )}

      <p className="mt-4 text-center text-sm text-slate-500">
        Já tem conta?{' '}
        <Link href="/login" className="font-medium text-brand-600">
          Entrar
        </Link>
      </p>
    </Card>
  );
}

function translateError(code: string): string {
  if (code.includes('email-already-in-use')) return 'Já existe uma conta com esse email.';
  if (code.includes('weak-password')) return 'A senha precisa ter pelo menos 8 caracteres.';
  if (code.includes('invalid-email')) return 'Email inválido.';
  return 'Não foi possível criar a conta. Tente novamente.';
}
