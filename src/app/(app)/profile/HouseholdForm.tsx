'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { Input, Label, FieldError } from '@/components/ui/Input';
import { renameHousehold, type FormActionState } from './actions';

const initialState: FormActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Salvando…' : 'Salvar'}
    </Button>
  );
}

export function HouseholdForm({ name }: { name: string }) {
  const [state, formAction] = useFormState(renameHousehold, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <Label htmlFor="name">Nome da família</Label>
        <Input id="name" name="name" defaultValue={name} required />
      </div>
      <FieldError>{state.error}</FieldError>
      {state.success && <p className="text-sm text-brand-600">Família atualizada.</p>}
      <SubmitButton />
    </form>
  );
}
