import { TableSkeleton } from '@/components/ui/TableSkeleton';

export default function InterviewsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-64 bg-slate-200 rounded-lg animate-pulse dark:bg-slate-800" />
      <div className="h-24 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 animate-pulse" />
      <TableSkeleton rows={6} />
    </div>
  );
}
