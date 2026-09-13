'use client';

import { useFormStatus } from 'react-dom';
import { Button } from './Button';
import type { ComponentProps } from 'react';

/**
 * A submit button that shows immediate visual feedback while its parent
 * form is pending — must be rendered inside a <form action={...}>, since
 * useFormStatus reads the nearest form ancestor's state.
 */
export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} {...props}>
      {pending ? (pendingLabel ?? 'Salvando…') : children}
    </Button>
  );
}
