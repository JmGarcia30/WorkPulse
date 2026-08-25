import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { logoutAction } from '@/lib/auth/actions';
import { prisma } from '@/lib/db/prisma';
import {
  Briefcase,
  LayoutDashboard,
  Users,
  Building2,
  LogOut,
  ExternalLink,
  Kanban,
  Calendar,
  Award,
  FileText,
  UserCheck,
} from 'lucide-react';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) {
    redirect('/login');
  }

  // Fetch organization name
  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    select: { name: true, slug: true },
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo & Org Context */}
          <div className="p-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold shadow-sm">
                WP
              </div>
              <div>
                <h2 className="text-sm font-bold leading-tight">WorkPulse</h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                  {org?.name || 'Organization'}
                </p>
              </div>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="p-3 space-y-1">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <LayoutDashboard className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Overview</span>
            </Link>

            <div className="pt-3 pb-1 px-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Recruitment
              </span>
            </div>

            <Link
              href="/dashboard/hiring/pipeline"
              className="flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <Kanban className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>ATS Pipeline</span>
            </Link>

            <Link
              href="/dashboard/hiring/jobs"
              className="flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <Briefcase className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Job Postings</span>
            </Link>

            <Link
              href="/dashboard/hiring/applicants"
              className="flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Applicants</span>
            </Link>

            <Link
              href="/dashboard/hiring/interviews"
              className="flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Interviews</span>
            </Link>

            <Link
              href="/dashboard/hiring/assessments"
              className="flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <Award className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Assessments</span>
            </Link>

            <Link
              href="/dashboard/hiring/offers"
              className="flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Offers</span>
            </Link>

            <Link
              href="/dashboard/hiring/onboarding"
              className="flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <UserCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Onboarding</span>
            </Link>

            <div className="pt-3 pb-1 px-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Portals
              </span>
            </div>

            <Link
              href="/careers"
              target="_blank"
              className="flex items-center justify-between px-3 py-2.5 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-slate-500" />
                <span>Careers Portal</span>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
            </Link>
          </nav>
        </div>

        {/* User Account Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-950">
            <div className="truncate">
              <p className="text-xs font-semibold truncate">{user.name}</p>
              <span className="inline-block rounded-md bg-indigo-50 dark:bg-indigo-950 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 dark:text-indigo-300">
                {user.role}
              </span>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Workforce Hiring Center
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {org?.name} • Multi-Tenant SaaS Workspace
            </p>
          </div>
        </header>

        <div className="p-6 flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
