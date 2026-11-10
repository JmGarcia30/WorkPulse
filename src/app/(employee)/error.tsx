'use client';

import { ErrorState } from '@/components/ui/ErrorState';

export default function EmployeeWorkspaceError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <main className="mx-auto max-w-3xl p-6">
    <ErrorState
      title="Employee page unavailable"
      message="We couldn't load this information. Retry the request. If the issue continues, contact HR."
      onRetry={reset}
      resetHref="/employee"
    />
  </main>;
}
