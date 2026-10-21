import { Skeleton, SkeletonFilters, SkeletonHeader, SkeletonPanel } from './Skeleton';
import { SkeletonCard } from './SkeletonCard';
import { TableSkeleton } from './TableSkeleton';

type PageKind = 'dashboard' | 'employees' | 'jobs' | 'attendance' | 'leave' | 'payroll' | 'analytics' | 'profile' | 'pipeline' | 'interviews';
function Metrics({ count = 3 }: { count?: number }) {
  const columns = count === 5 ? 'sm:grid-cols-2 lg:grid-cols-5' : count === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3';
  return <div className={`grid grid-cols-1 gap-4 ${columns}`}>{Array.from({ length: count }, (_, i) => <SkeletonPanel key={i} className="space-y-4"><Skeleton className="h-4 w-28" /><Skeleton className="h-8 w-20" /><Skeleton className="h-3 w-36" /></SkeletonPanel>)}</div>;
}
function Chart() {
  return <SkeletonPanel className="space-y-5"><Skeleton className="h-5 w-40" /><div className="flex h-48 items-end gap-4 border-b border-[var(--wp-border)] px-3">{[40, 70, 55, 90, 65, 80].map((height, i) => <div key={i} className="min-w-0 flex-1 rounded-t bg-[var(--wp-surface-subtle)]" style={{ height: `${height}%` }} />)}</div></SkeletonPanel>;
}
export function PageSkeleton({ kind = 'dashboard', label = 'workspace' }: { kind?: PageKind; label?: string }) {
  const table = kind === 'employees' || kind === 'jobs' || kind === 'interviews';
  return <div role="status" aria-busy="true" aria-label={`Loading ${label}`} data-wp-loading={kind} className="min-w-0 space-y-6">
    <span className="sr-only">Loading {label}…</span>
    <div aria-hidden="true" className="min-w-0 space-y-6">
      <SkeletonHeader />
      {table ? <><SkeletonFilters count={kind === 'employees' ? 4 : 2} /><TableSkeleton rows={6} cols={kind === 'jobs' ? 7 : 6} /></>
      : kind === 'pipeline' ? <><SkeletonFilters /><div className="max-w-full overflow-x-auto pb-4"><div className="flex w-max gap-4">{Array.from({ length: 7 }, (_, i) => <SkeletonPanel key={i} className="w-72 space-y-4"><Skeleton className="h-6 w-36" /><SkeletonCard count={1} /><SkeletonCard count={1} /></SkeletonPanel>)}</div></div></>
      : kind === 'profile' ? <><SkeletonPanel className="flex flex-wrap items-center gap-5"><Skeleton className="h-20 w-20 rounded-full" /><div className="min-w-0 flex-1 space-y-3"><Skeleton className="h-6 w-64" /><Skeleton className="h-4 w-80" /></div></SkeletonPanel><div className="grid grid-cols-3 gap-3 sm:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div><SkeletonCard count={4} /></>
      : kind === 'attendance' ? <><SkeletonFilters count={4} /><SkeletonPanel className="flex min-h-80 items-center justify-center"><div className="w-64 space-y-4"><Skeleton className="mx-auto h-12 w-12 rounded-full" /><Skeleton className="h-5 w-full" /><Skeleton className="h-4 w-5/6 mx-auto" /></div></SkeletonPanel></>
      : kind === 'analytics' ? <><SkeletonFilters count={3} />{Array.from({ length: 3 }, (_, i) => <SkeletonPanel key={i} className="space-y-6"><Skeleton className="h-6 w-52" /><Metrics /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-3/4" /></SkeletonPanel>)}</>
      : <>{kind === 'leave' && <SkeletonFilters />}<Metrics count={kind === 'payroll' ? 5 : kind === 'leave' ? 4 : 3} /><div className="grid gap-5 xl:grid-cols-3"><div className="min-w-0 space-y-5 xl:col-span-2"><Chart /><TableSkeleton rows={4} cols={4} /></div><SkeletonPanel className="space-y-5"><Skeleton className="h-5 w-40" />{Array.from({ length: 5 }, (_, i) => <div key={i} className="space-y-3 border-b border-[var(--wp-border)] pb-5"><Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-3/4" /></div>)}</SkeletonPanel></div></>}
    </div>
  </div>;
}
