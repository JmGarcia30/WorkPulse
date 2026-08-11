import Link from 'next/link';
import { Briefcase } from 'lucide-react';

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 sticky top-0 z-50 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/careers" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold shadow-sm">
              WP
            </div>
            <div>
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                WorkPulse Careers
              </span>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                St. Aloysius Gonzaga Academy Portal
              </p>
            </div>
          </Link>

          <Link
            href="/login"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            HR Portal Login →
          </Link>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8">{children}</main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-slate-500 dark:text-slate-400">
          © {new Date().getFullYear()} WorkPulse SaaS • St. Aloysius Gonzaga Academy, Inc. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
