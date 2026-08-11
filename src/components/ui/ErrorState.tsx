import Link from 'next/link';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  resetHref?: string;
}

export function ErrorState({
  title = 'An Error Occurred',
  message = 'We encountered an unexpected error while processing your request. Please try again.',
  onRetry,
  resetHref = '/dashboard',
}: ErrorStateProps) {
  return (
    <div className="max-w-md mx-auto my-8 rounded-2xl border border-rose-200 bg-rose-50/70 p-6 text-center shadow-xs dark:border-rose-900/60 dark:bg-rose-950/40 space-y-4">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/60 dark:text-rose-400">
        <AlertCircle className="h-6 w-6" />
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-bold text-rose-900 dark:text-rose-200">{title}</h3>
        <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">{message}</p>
      </div>

      <div className="pt-2 flex items-center justify-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-500 transition"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Try Again
          </button>
        )}
        <Link
          href={resetHref}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
}
