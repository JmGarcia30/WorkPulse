'use client';

import { ErrorState } from '@/components/ui/ErrorState';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-8">
      <ErrorState
        title="Dashboard Request Error"
        message={error?.message || 'An error occurred while rendering the dashboard. Please refresh or try again.'}
        onRetry={reset}
        resetHref="/dashboard"
      />
    </div>
  );
}
