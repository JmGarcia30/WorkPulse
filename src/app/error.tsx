'use client';

import { ErrorState } from '@/components/ui/ErrorState';

export default function ApplicationError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <main className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center p-6">
    <ErrorState
      title="This page could not be loaded"
      message="The request could not be completed. Retry, or return to the homepage. No changes were made by this error screen."
      onRetry={reset}
      resetHref="/"
    />
  </main>;
}
