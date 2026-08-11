export function SkeletonCard({ count = 2 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="animate-pulse rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 w-24 rounded-md bg-slate-200 dark:bg-slate-800" />
            <div className="h-5 w-16 rounded-md bg-slate-100 dark:bg-slate-800" />
          </div>
          <div className="h-5 w-3/4 rounded-md bg-slate-200 dark:bg-slate-800" />
          <div className="space-y-2">
            <div className="h-3 w-full rounded-md bg-slate-100 dark:bg-slate-800" />
            <div className="h-3 w-5/6 rounded-md bg-slate-100 dark:bg-slate-800" />
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-between">
            <div className="h-3 w-20 rounded-md bg-slate-100 dark:bg-slate-800" />
            <div className="h-3 w-16 rounded-md bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      ))}
    </div>
  );
}
