import { SkeletonCard } from '@/components/ui/SkeletonCard';

export default function PipelineLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5 dark:border-slate-800">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded-md" />
          <div className="h-3 w-80 bg-slate-100 dark:bg-slate-900 rounded-md" />
        </div>
        <div className="h-9 w-28 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>

      {/* Filter Bar Skeleton */}
      <div className="h-16 w-full bg-slate-100 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800" />

      {/* Kanban Columns Skeleton */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {[1, 2, 3, 4, 5, 6, 7].map((col) => (
            <div
              key={col}
              className="w-80 min-w-[280px] shrink-0 rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50 p-3 space-y-3"
            >
              <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg w-full mb-4" />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
