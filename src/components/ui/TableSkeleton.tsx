export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden dark:border-slate-800 dark:bg-slate-900">
      <div className="h-10 border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950" />
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div key={rIdx} className="flex items-center justify-between px-4 py-4 gap-4">
            {Array.from({ length: cols }).map((_, cIdx) => (
              <div
                key={cIdx}
                className="h-3 rounded-md bg-slate-200 dark:bg-slate-800 flex-1"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
