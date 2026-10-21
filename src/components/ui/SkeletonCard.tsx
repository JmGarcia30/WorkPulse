import { Skeleton, SkeletonPanel } from './Skeleton';

export function SkeletonCard({ count = 2, stacked = false }: { count?: number; stacked?: boolean }) {
  return <div aria-hidden="true" className={`grid min-w-0 gap-4 ${stacked || count === 1 ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
    {Array.from({ length: count }, (_, i) => <SkeletonPanel key={i} className="space-y-4">
      <div className="flex items-center justify-between gap-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-5 w-16" /></div>
      <Skeleton className="h-5 w-3/4" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-5/6" />
      <div className="flex justify-between gap-3 border-t border-[var(--wp-border)] pt-3"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-16" /></div>
    </SkeletonPanel>)}
  </div>;
}
