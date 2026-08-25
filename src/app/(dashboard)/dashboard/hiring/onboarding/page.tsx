import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { canViewHiringData, canManageOnboarding } from '@/lib/permissions/rbac';
import { OnboardingStatus, OnboardingTaskStatus } from '@prisma/client';
import {
  ONBOARDING_STATUS_CONFIG,
  calculateOnboardingProgress,
} from '@/features/hiring/onboarding-pipeline';
import {
  UserCheck,
  Search,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  Filter,
  FileCheck,
  AlertCircle,
} from 'lucide-react';

interface OnboardingPageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
  }>;
}

export default async function OnboardingManagementPage({
  searchParams,
}: OnboardingPageProps) {
  const user = await getSession();
  if (!user || !canViewHiringData(user)) {
    return (
      <div className="p-6 text-center text-slate-500">
        Unauthorized to access Onboarding Management.
      </div>
    );
  }

  const { search, status: statusFilter } = await searchParams;

  // Query Onboarding Processes strictly scoped to User Organization
  const onboardingProcesses = await prisma.onboardingProcess.findMany({
    where: {
      application: {
        job: { organizationId: user.organizationId },
      },
      ...(statusFilter && statusFilter !== 'ALL'
        ? { status: statusFilter as OnboardingStatus }
        : {}),
      ...(search
        ? {
            application: {
              job: { organizationId: user.organizationId },
              OR: [
                {
                  applicant: {
                    OR: [
                      { firstName: { contains: search, mode: 'insensitive' } },
                      { lastName: { contains: search, mode: 'insensitive' } },
                      { email: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
                {
                  job: {
                    title: { contains: search, mode: 'insensitive' },
                  },
                },
              ],
            },
          }
        : {}),
    },
    include: {
      application: {
        include: {
          applicant: true,
          job: true,
        },
      },
      tasks: true,
    },
    orderBy: { startDate: 'desc' },
  });

  // Calculate high-level organization onboarding metrics
  const allOrgProcesses = await prisma.onboardingProcess.findMany({
    where: {
      application: {
        job: { organizationId: user.organizationId },
      },
    },
    include: {
      tasks: { select: { status: true, isRequired: true } },
    },
  });

  const totalInOnboarding = allOrgProcesses.filter(
    (p) => p.status === OnboardingStatus.IN_PROGRESS
  ).length;

  const totalCompleted = allOrgProcesses.filter(
    (p) => p.status === OnboardingStatus.COMPLETED
  ).length;

  const pendingVerificationCount = allOrgProcesses
    .flatMap((p) => p.tasks)
    .filter((t) => t.status === OnboardingTaskStatus.SUBMITTED).length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-linear-to-r from-indigo-700 via-indigo-600 to-slate-800 p-6 text-white shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-indigo-200" />
            <h2 className="text-xl font-bold">Employee Onboarding Center</h2>
          </div>
          <p className="text-xs text-indigo-100 mt-1">
            Track hired candidates, verify pre-employment clearance documents, and manage Day 1 institutional readiness.
          </p>
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
              Active New Hires
            </span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <UserCheck className="h-5 w-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">{totalInOnboarding}</p>
          <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
            Currently completing onboarding checklists.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
              Pending Document Reviews
            </span>
            <div className="rounded-xl bg-purple-50 p-2 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
              <FileCheck className="h-5 w-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">{pendingVerificationCount}</p>
          <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
            Submitted items requiring HR verification.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
              Completed Onboarding
            </span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">{totalCompleted}</p>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            100% verified & cleared employees.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <form method="GET" className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              name="search"
              defaultValue={search || ''}
              placeholder="Search candidate name, email, or role..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-slate-100 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition"
          >
            Search
          </button>
        </form>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { label: 'All', value: 'ALL' },
            { label: 'In Progress', value: OnboardingStatus.IN_PROGRESS },
            { label: 'Completed', value: OnboardingStatus.COMPLETED },
            { label: 'Not Started', value: OnboardingStatus.NOT_STARTED },
          ].map((tab) => (
            <Link
              key={tab.value}
              href={`/dashboard/hiring/onboarding?${new URLSearchParams({
                ...(search ? { search } : {}),
                ...(tab.value !== 'ALL' ? { status: tab.value } : {}),
              }).toString()}`}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                (statusFilter === tab.value || (!statusFilter && tab.value === 'ALL'))
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Onboarding Records Grid / Table */}
      {onboardingProcesses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900 space-y-3">
          <UserCheck className="mx-auto h-10 w-10 text-slate-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            No Onboarding Records Found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Hired candidates with accepted offer packages will automatically appear here to track their onboarding progress.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {onboardingProcesses.map((proc) => {
            const applicant = proc.application.applicant;
            const job = proc.application.job;
            const progress = calculateOnboardingProgress(proc.tasks);
            const statusConfig = ONBOARDING_STATUS_CONFIG[proc.status];

            return (
              <div
                key={proc.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4 hover:border-indigo-300 dark:hover:border-indigo-700 transition"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {applicant.firstName} {applicant.lastName}
                      </h4>
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${statusConfig.badgeBg} ${statusConfig.badgeText}`}
                      >
                        {statusConfig.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {job.title} • {job.department}
                    </p>
                  </div>

                  <Link
                    href={`/dashboard/hiring/applicants/${proc.applicationId}`}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition shrink-0 flex items-center gap-1"
                  >
                    <span>View Profile</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {/* Dates & Timeline */}
                <div className="grid grid-cols-2 gap-2 text-[11px] rounded-xl bg-slate-50 dark:bg-slate-800/50 p-3 border border-slate-100 dark:border-slate-800">
                  <div className="space-y-0.5">
                    <span className="text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
                      Start Date
                    </span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {new Date(proc.startDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
                      Target Completion
                    </span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {proc.targetCompletionDate
                        ? new Date(proc.targetCompletionDate).toLocaleDateString()
                        : 'Open'}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-600 dark:text-slate-400 text-[11px]">
                      Checklist Items: {progress.completedTasks} / {progress.totalTasks} Verified
                    </span>
                    <span className="text-indigo-600 dark:text-indigo-400">
                      {progress.percentComplete}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full transition-all duration-300 ${
                        progress.percentComplete === 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${progress.percentComplete}%` }}
                    />
                  </div>
                </div>

                {/* Task Breakdown Chips */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span>{progress.verifiedCount} Verified</span>
                  {progress.submittedCount > 0 && (
                    <span className="text-purple-600 font-bold">{progress.submittedCount} Review Needed</span>
                  )}
                  <span>{progress.pendingCount} Pending</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
