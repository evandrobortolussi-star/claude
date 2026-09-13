'use client';

import { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * A submit button that asks for confirmation before letting the form submit
 * through — used for the "excluir" action on financial movements, which is
 * always a soft delete (see deleted_at across the schema) but still
 * shouldn't happen from a stray tap.
 */
export function ConfirmSubmitButton({
  confirmMessage,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { confirmMessage: string }) {
  return (
    <button
      type="submit"
      className={cn('text-xs font-medium text-slate-400 hover:text-red-500', className)}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
}
