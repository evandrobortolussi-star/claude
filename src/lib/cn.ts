import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// twMerge resolves conflicting Tailwind utilities (e.g. a base `bg-cream`
// plus an override `bg-brand-700`) deterministically by keeping the last
// one — a plain string join leaves that to Tailwind's generated CSS order,
// which isn't guaranteed to match the order classes appear in a className.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
