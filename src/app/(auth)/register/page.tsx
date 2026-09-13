'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input, Label, FieldError } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/cn';

export default function RegisterPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get('email'));
    const password = String(formData.get('password'));
    const fullName = String(formData.get('name'));

    const metadata: Record<string, string> =
      mode === 'create'
        ? { mode: 'create', household_name: String(formData.get('householdName')), full_name: fullName }
        : { mode: 'join', invite_code: String(formData.get('inviteCode')).toUpperCase(), full_name: fullName };

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });

    setLoading(false);
    if (signUpError) {
      setError(translateError(signUpError.message));
      return;
    }

    if (data.session) {
      router.push('/dashboard');
      router.refresh();
    } else {
      setNeedsConfirmation(true);
    }
  }

  if (needsConfirmation) {
    return (
      <Card>
        <p className="text-center text-sm text-slate-600">
          Conta criada! Confirme seu email para poder entrar — enviamos um link de confirmação.
        </p>
        <Link href="/login" className="mt-4 block text-center text-sm font-medium text-brand-600">
          Ir para o login
        </Link>
      </Card>
    );
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

function translateError(message: string): string {
  if (message.includes('already registered')) return 'Já existe uma conta com esse email.';
  if (message.includes('Código de convite inválido')) return 'Código de convite inválido.';
  if (message.includes('já possui dois membros')) return 'Esta família já possui dois membros.';
  if (message.includes('Password should be')) return 'A senha precisa ter pelo menos 8 caracteres.';
  return 'Não foi possível criar a conta. Tente novamente.';
}
