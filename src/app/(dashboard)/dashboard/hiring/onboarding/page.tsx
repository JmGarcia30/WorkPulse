import { MetricStrip } from '@/components/ui/Workspace';
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { canViewHiringData, canViewEmployees } from '@/lib/permissions/rbac';
import { OnboardingStatus, OnboardingTaskStatus } from '@prisma/client';
import {
  ONBOARDING_STATUS_CONFIG,
  calculateOnboardingProgress,
} from '@/features/hiring/onboarding-pipeline';
import { UserCheck, Search, ArrowRight } from 'lucide-react';

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
          employee: { select: { id: true, employeeStatus: true } },
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
      { /* Workspace controls */ }
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--wp-border)] pb-5 text-[var(--wp-text)]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--tenant-tint)] text-[var(--tenant-primary)]">
              <UserCheck className="h-6 w-6" />
            </div>
            <h1 className="wp-page-title">Onboarding</h1>
          </div>
          <p className="text-sm text-[var(--wp-text-muted)] mt-1 pl-12.5">
            Track hired candidates, verify pre-employment clearance documents, and manage Day 1 institutional readiness.
          </p>
        </div>
      </div>

      <MetricStrip items={[
        { label: 'In progress', value: totalInOnboarding, helper: 'Active onboarding checklists', href: '/dashboard/hiring/onboarding?status=IN_PROGRESS' },
        { label: 'Awaiting verification', value: pendingVerificationCount, helper: 'Submitted tasks needing review', href: '/dashboard/hiring/onboarding' },
        { label: 'Completed', value: totalCompleted, helper: 'Completed onboarding checklists', href: '/dashboard/hiring/onboarding?status=COMPLETED' },
      ]} />

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-[var(--wp-border)] bg-white p-5">
        <form method="GET" className="flex items-center gap-2 flex-1 max-w-md">
          {statusFilter && <input type="hidden" aria-label="Status" name="status" value={statusFilter} />}<div className="relative min-w-0 flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-[var(--wp-text-muted)]" />
            <input
              type="text"
              aria-label="Search records" name="search"
              defaultValue={search || ''}
              placeholder="Search candidate name, email, or role..."
              className="w-full rounded-lg border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] pl-10 pr-4 py-2.5 text-sm font-semibold text-[var(--wp-text)] focus:border-[var(--tenant-accent)] focus:bg-white focus:ring-1 focus:ring-[var(--tenant-accent)] transition"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-[var(--tenant-primary)] px-5 py-2.5 text-sm font-bold text-[var(--tenant-primary-foreground)] hover:brightness-95 transition"
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
              className={`rounded-md px-4 py-1.5 text-sm font-bold transition-all whitespace-nowrap ${
                (statusFilter === tab.value || (!statusFilter && tab.value === 'ALL'))
                  ? 'bg-[var(--tenant-primary)] text-[var(--tenant-primary-foreground)] '
                  : 'bg-[var(--wp-surface-subtle)] text-[var(--wp-text-muted)] hover:text-[var(--wp-text)] hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Onboarding Records Grid / Table */}
      {onboardingProcesses.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--wp-border)] bg-white p-12 text-center space-y-3">
          <UserCheck className="mx-auto h-10 w-10 text-[var(--wp-text-muted)]" />
          <h3 className="text-sm font-bold text-[var(--wp-text)]">
            No Onboarding Records Found
          </h3>
          <p className="text-sm text-[var(--wp-text-muted)] max-w-sm mx-auto">
            Candidates appear here once an onboarding checklist is initialized from their accepted offer.
          </p>
        </div>
      ) : (
        <div className="wp-table-wrap">
          <table className="wp-table"><caption className="sr-only">Candidate onboarding progress and employee handoff</caption>
            <thead><tr><th>Candidate / position</th><th>Status</th><th>Start / target</th><th>Checklist progress</th><th>Needs review</th><th>Employee handoff</th><th>Action</th></tr></thead>
            <tbody>{onboardingProcesses.map(proc => {
              const applicant = proc.application.applicant;
              const progress = calculateOnboardingProgress(proc.tasks);
              const statusConfig = ONBOARDING_STATUS_CONFIG[proc.status];
              return <tr key={proc.id}>
                <td><Link className="font-semibold hover:underline" href={`/dashboard/hiring/applicants/${proc.applicationId}`}>{applicant.firstName} {applicant.lastName}</Link><p className="mt-1 text-sm text-[var(--wp-text-muted)]">{proc.application.job.title} · {proc.application.job.department}</p></td>
                <td><span className={`wp-status ${statusConfig.badgeBg} ${statusConfig.badgeText}`}>{statusConfig.label}</span></td>
                <td className="whitespace-nowrap"><p>{new Date(proc.startDate).toLocaleDateString()}</p><p className="mt-1 text-sm text-[var(--wp-text-muted)]">{proc.targetCompletionDate ? new Date(proc.targetCompletionDate).toLocaleDateString() : 'No target set'}</p></td>
                <td className="min-w-44"><p className="text-sm">{progress.completedTasks} / {progress.totalTasks} complete · {progress.percentComplete}%</p><progress aria-label={`Checklist completion for ${applicant.firstName} ${applicant.lastName}`} value={progress.percentComplete} max={100} className="mt-2 h-1.5 w-full accent-[var(--tenant-primary)]" /><p className="mt-1 text-sm text-[var(--wp-text-muted)]">{progress.verifiedCount} verified · {progress.pendingCount} pending</p></td>
                <td><span className={progress.submittedCount > 0 ? 'font-semibold text-amber-800' : 'text-[var(--wp-text-muted)]'}>{progress.submittedCount} submitted</span></td>
                <td>{proc.application.employee ? (canViewEmployees(user) ? <Link href={`/dashboard/employees/${proc.application.employee.id}`} className="font-semibold text-[var(--tenant-primary)] hover:underline">View employee record</Link> : <span>Employee record created</span>) : <span className="text-[var(--wp-text-muted)]">Hiring review pending</span>}</td>
                <td><Link href={`/dashboard/hiring/applicants/${proc.applicationId}#candidate-onboarding`} className="wp-button-secondary whitespace-nowrap">Review checklist <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
