'use client';

import { ErrorState } from '@/components/ui/ErrorState';

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-8">
      <ErrorState
        title="We couldn’t load this page"
        message="Something went wrong while loading this page. Please try again."
        onRetry={reset}
        resetHref="/dashboard"
      />
    </div>
  );
}
