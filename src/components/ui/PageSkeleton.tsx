import { Skeleton, SkeletonFilters, SkeletonHeader, SkeletonPanel } from './Skeleton';
import { SkeletonCard } from './SkeletonCard';
import { TableSkeleton } from './TableSkeleton';

type PageKind = 'dashboard' | 'employees' | 'jobs' | 'attendance' | 'leave' | 'payroll' | 'analytics' | 'profile' | 'pipeline' | 'interviews'
  | 'hiring' | 'list' | 'records' | 'detail' | 'form' | 'settings' | 'calendar' | 'payslip' | 'self-service' | 'careers' | 'candidate';
function Metrics({ count = 3 }: { count?: number }) {
  const columns = count === 5 ? 'sm:grid-cols-2 lg:grid-cols-5' : count === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3';
  return <div className={`grid grid-cols-1 gap-4 ${columns}`}>{Array.from({ length: count }, (_, i) => <SkeletonPanel key={i} className="space-y-4"><Skeleton className="h-4 w-28" /><Skeleton className="h-8 w-20" /><Skeleton className="h-3 w-36" /></SkeletonPanel>)}</div>;
}
function Chart() {
  return <SkeletonPanel className="space-y-5"><Skeleton className="h-5 w-40" /><div className="flex h-48 items-end gap-4 border-b border-[var(--wp-border)] px-3">{[40, 70, 55, 90, 65, 80].map((height, i) => <div key={i} className="min-w-0 flex-1 rounded-t bg-[var(--wp-surface-subtle)]" style={{ height: `${height}%` }} />)}</div></SkeletonPanel>;
}
function Fields({ count = 6 }: { count?: number }) {
  return <SkeletonPanel className="space-y-5"><Skeleton className="h-5 w-48" /><div className="grid gap-5 sm:grid-cols-2">{Array.from({ length: count }, (_, i) => <div key={i} className="min-w-0 space-y-2"><Skeleton className="h-3 w-28" /><Skeleton className="h-10 w-full" /></div>)}</div></SkeletonPanel>;
}
function Calendar() {
  return <SkeletonPanel className="space-y-4"><Skeleton className="h-5 w-48" /><div className="grid grid-cols-7 gap-1 sm:gap-2">{Array.from({ length: 35 }, (_, i) => <Skeleton key={i} className="h-12 w-full sm:h-20" />)}</div></SkeletonPanel>;
}
function Details() {
  return <><Fields /><SkeletonPanel className="space-y-4"><Skeleton className="h-5 w-40" />{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-4 w-full" />)}</SkeletonPanel></>;
}
export function PageSkeleton({ kind = 'dashboard', label = 'workspace' }: { kind?: PageKind; label?: string }) {
  const table = kind === 'employees' || kind === 'jobs' || kind === 'list';
  return <div role="status" aria-busy="true" aria-label={`Loading ${label}`} data-wp-loading={kind} className="min-w-0 space-y-6">
    <span className="sr-only">Loading {label}…</span>
    <div aria-hidden="true" className="min-w-0 space-y-6">
      <SkeletonHeader />
      {table ? <><SkeletonFilters count={kind === 'employees' ? 4 : 2} /><TableSkeleton rows={6} cols={kind === 'jobs' ? 7 : 6} /></>
      : kind === 'hiring' || kind === 'interviews' ? <><SkeletonFilters /><div className="grid gap-6 lg:grid-cols-3"><div className="min-w-0 lg:col-span-2"><SkeletonCard count={6} /></div><div className="hidden min-w-0 lg:block"><Fields count={4} /></div></div></>
      : kind === 'pipeline' ? <><SkeletonFilters /><div className="max-w-full overflow-x-auto pb-4"><div className="flex w-max gap-4">{Array.from({ length: 7 }, (_, i) => <SkeletonPanel key={i} className="w-72 space-y-4"><Skeleton className="h-6 w-36" /><SkeletonCard count={1} /><SkeletonCard count={1} /></SkeletonPanel>)}</div></div></>
      : kind === 'profile' ? <><SkeletonPanel className="flex flex-wrap items-center gap-5"><Skeleton className="h-20 w-20 rounded-full" /><div className="min-w-0 flex-1 space-y-3"><Skeleton className="h-6 w-64" /><Skeleton className="h-4 w-80" /></div></SkeletonPanel><div className="grid grid-cols-3 gap-3 sm:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div><SkeletonCard count={4} /></>
      : kind === 'attendance' ? <><SkeletonFilters count={4} /><SkeletonPanel className="flex min-h-80 items-center justify-center"><div className="w-64 space-y-4"><Skeleton className="mx-auto h-12 w-12 rounded-full" /><Skeleton className="h-5 w-full" /><Skeleton className="h-4 w-5/6 mx-auto" /></div></SkeletonPanel></>
      : kind === 'calendar' ? <><SkeletonFilters count={2} /><Metrics /><Calendar /><SkeletonCard count={2} /></>
      : kind === 'form' || kind === 'settings' ? <><Fields count={kind === 'settings' ? 8 : 6} /><Fields count={2} /><div className="flex flex-col gap-3 sm:flex-row sm:justify-end"><Skeleton className="h-10 w-full sm:w-32" /><Skeleton className="h-10 w-full sm:w-40" /></div></>
      : kind === 'detail' ? <Details />
      : kind === 'records' ? <SkeletonCard count={3} stacked />
      : kind === 'payslip' ? <div className="mx-auto max-w-4xl space-y-6"><Fields count={4} /><TableSkeleton rows={5} cols={3} /><SkeletonPanel className="flex flex-wrap justify-between gap-4"><Skeleton className="h-5 w-40" /><Skeleton className="h-8 w-48" /></SkeletonPanel></div>
      : kind === 'self-service' ? <><SkeletonCard count={2} /><Fields count={2} /><Metrics /><SkeletonCard count={2} /></>
      : kind === 'careers' ? <><SkeletonPanel className="space-y-4 py-10"><Skeleton className="h-8 w-80" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></SkeletonPanel><SkeletonFilters count={2} /><SkeletonCard count={4} /></>
      : kind === 'candidate' ? <div className="mx-auto max-w-4xl space-y-6"><SkeletonPanel className="space-y-5"><Skeleton className="h-6 w-64" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /><Skeleton className="h-10 w-full" /></SkeletonPanel><SkeletonCard count={2} /></div>
      : kind === 'payroll' ? <><Metrics count={5} /><SkeletonFilters count={2} /><TableSkeleton rows={6} cols={6} /></>
      : kind === 'analytics' ? <><SkeletonFilters count={3} />{Array.from({ length: 3 }, (_, i) => <SkeletonPanel key={i} className="space-y-6"><Skeleton className="h-6 w-52" /><Metrics /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-3/4" /></SkeletonPanel>)}</>
      : <>{kind === 'leave' && <SkeletonFilters />}<Metrics count={kind === 'leave' ? 4 : 3} /><div className="grid gap-5 xl:grid-cols-3"><div className="min-w-0 space-y-5 xl:col-span-2"><Chart /><TableSkeleton rows={4} cols={4} /></div><SkeletonPanel className="space-y-5"><Skeleton className="h-5 w-40" />{Array.from({ length: 5 }, (_, i) => <div key={i} className="space-y-3 border-b border-[var(--wp-border)] pb-5"><Skeleton className="h-4 w-full" /><Skeleton className="h-3 w-3/4" /></div>)}</SkeletonPanel></div></>}
    </div>
  </div>;
}
