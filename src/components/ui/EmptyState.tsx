import Link from 'next/link';
import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-12 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
        <Icon className="h-7 w-7" />
      </div>

      <div className="space-y-1 max-w-sm mx-auto">
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          {description}
        </p>
      </div>

      {actionLabel && (
        <div className="pt-2">
          {actionHref ? (
            <Link
              href={actionHref}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-sm transition"
            >
              {actionLabel}
            </Link>
          ) : onAction ? (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 shadow-sm transition"
            >
              {actionLabel}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
