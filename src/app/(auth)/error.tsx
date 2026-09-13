'use client';

import { GenericError } from '@/components/GenericError';

export default function AuthError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <GenericError reset={reset} />;
}
