import { Skeleton } from './Skeleton';
import { SkeletonCard } from './SkeletonCard';

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return <div aria-hidden="true" className="min-w-0">
    <div className="md:hidden"><SkeletonCard count={3} stacked /></div>
    <div className="hidden overflow-hidden rounded-lg border border-[var(--wp-border)] bg-[var(--wp-surface)] md:block">
      <div className="h-12 border-b border-[var(--wp-border)] bg-[var(--wp-surface-subtle)]" />
      <div className="divide-y divide-[var(--wp-border)]">
        {Array.from({ length: rows }, (_, row) => <div key={row} className="flex items-center gap-5 px-5 py-5">
          {Array.from({ length: cols }, (_, col) => <Skeleton key={col} className="h-4 min-w-0 flex-1" />)}
        </div>)}
      </div>
      <div className="flex justify-between gap-4 border-t border-[var(--wp-border)] p-4"><Skeleton className="h-4 w-40" /><Skeleton className="h-8 w-48" /></div>
    </div>
  </div>;
}
