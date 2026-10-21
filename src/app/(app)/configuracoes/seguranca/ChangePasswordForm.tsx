'use client';

import { FormEvent, useState } from 'react';
import { updatePassword } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { Button } from '@/components/ui/Button';
import { Input, Label, FieldError } from '@/components/ui/Input';

export function ChangePasswordForm() {
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);
    const password = String(formData.get('password'));
    const confirmPassword = String(formData.get('confirmPassword'));

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const user = getFirebaseAuth().currentUser;
      if (!user) throw new Error('not-signed-in');
      await updatePassword(user, password);
      setSuccess(true);
      e.currentTarget.reset();
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code.includes('requires-recent-login')) {
        setError('Por segurança, saia e entre novamente antes de trocar a senha.');
      } else {
        setError('Não foi possível trocar a senha. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label htmlFor="password">Nova senha</Label>
        <Input id="password" name="password" type="password" minLength={8} required autoComplete="new-password" />
      </div>
      <div>
        <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          minLength={8}
          required
          autoComplete="new-password"
        />
      </div>
      <FieldError>{error}</FieldError>
      {success && <p className="text-sm text-brand-600">Senha atualizada com sucesso.</p>}
      <Button type="submit" disabled={loading}>
        {loading ? 'Salvando…' : 'Trocar senha'}
      </Button>
    </form>
  );
}
