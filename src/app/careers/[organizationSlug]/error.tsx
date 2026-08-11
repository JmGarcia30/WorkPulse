'use client';

import { ErrorState } from '@/components/ui/ErrorState';

export default function CareerPortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-8">
      <ErrorState
        title="Career Portal Error"
        message={error?.message || 'Unable to load the requested career portal. Please try again or return to directory.'}
        onRetry={reset}
        resetHref="/careers"
      />
    </div>
  );
}
