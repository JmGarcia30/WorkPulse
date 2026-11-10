'use client';

import { ErrorState } from '@/components/ui/ErrorState';

export default function HrNotificationsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <div className="p-5">
    <ErrorState title="HR notifications unavailable" message="We couldn't load your notifications. Try again. No notifications have been marked as read." onRetry={reset} resetHref="/dashboard" />
  </div>;
}
