'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { Input, Label, FieldError } from '@/components/ui/Input';
import { updateProfile, type FormActionState } from './actions';

const initialState: FormActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Salvando…' : 'Salvar'}
    </Button>
  );
}

export function ProfileForm({ fullName, avatarEmoji }: { fullName: string; avatarEmoji: string }) {
  const [state, formAction] = useFormState(updateProfile, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div>
          <Label htmlFor="fullName">Seu nome</Label>
          <Input id="fullName" name="fullName" defaultValue={fullName} required />
        </div>
        <div>
          <Label htmlFor="avatarEmoji">Avatar</Label>
          <Input id="avatarEmoji" name="avatarEmoji" defaultValue={avatarEmoji} maxLength={4} className="w-16 text-center text-lg" />
        </div>
      </div>
      <FieldError>{state.error}</FieldError>
      {state.success && <p className="text-sm text-brand-600">Perfil atualizado.</p>}
      <SubmitButton />
    </form>
  );
}
