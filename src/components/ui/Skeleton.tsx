import type { ReactNode } from 'react';

// Static placeholders avoid flashing and require no client JS or motion override.
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`max-w-full rounded-md bg-[var(--wp-border)] ${className}`} />;
}
export function SkeletonPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`min-w-0 rounded-lg border border-[var(--wp-border)] bg-[var(--wp-surface)] p-5 ${className}`}>{children}</div>;
}
export function SkeletonHeader() {
  return <div aria-hidden="true" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0 flex-1 space-y-3"><Skeleton className="h-3 w-40" /><Skeleton className="h-7 w-56" /><Skeleton className="h-4 w-96" /></div>
    <Skeleton className="h-10 w-full sm:w-40" />
  </div>;
}
export function SkeletonFilters({ count = 3 }: { count?: number }) {
  return <SkeletonPanel className="grid gap-3 sm:grid-cols-2 xl:flex xl:flex-wrap">
    <Skeleton className="h-10 w-full sm:col-span-2 xl:w-72" />
    {Array.from({ length: count }, (_, i) => <Skeleton key={i} className="h-10 w-full xl:w-36" />)}
  </SkeletonPanel>;
}
