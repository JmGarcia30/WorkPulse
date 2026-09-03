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
      {/* Top Banner (Matte Charcoal from reference image) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl bg-[#181A1C] p-7 text-white shadow-md">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white">
              <UserCheck className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-black">Employee Onboarding Center</h2>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-1 pl-12.5">
            Track hired candidates, verify pre-employment clearance documents, and manage Day 1 institutional readiness.
          </p>
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-[#E8EAED] bg-white p-6 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">
              Active New Hires
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#181A1C] text-white shadow-2xs">
              <UserCheck className="h-5 w-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-[#181A1C]">{totalInOnboarding}</p>
          <p className="text-[11px] text-[#6B7280] font-medium">
            Currently completing onboarding checklists.
          </p>
        </div>

        <div className="rounded-3xl border border-[#E8EAED] bg-white p-6 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">
              Pending Document Reviews
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#181A1C] text-white shadow-2xs">
              <FileCheck className="h-5 w-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-[#181A1C]">{pendingVerificationCount}</p>
          <p className="text-[11px] text-amber-600 font-bold">
            Submitted items requiring HR verification.
          </p>
        </div>

        <div className="rounded-3xl border border-[#E8EAED] bg-white p-6 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">
              Completed Onboarding
            </span>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#181A1C] text-white shadow-2xs">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <p className="text-3xl font-black text-[#181A1C]">{totalCompleted}</p>
          <p className="text-[11px] text-emerald-600 font-bold">
            100% verified & cleared employees.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-[#E8EAED] bg-white p-5 shadow-2xs">
        <form method="GET" className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-[#9CA3AF]" />
            <input
              type="text"
              name="search"
              defaultValue={search || ''}
              placeholder="Search candidate name, email, or role..."
              className="w-full rounded-2xl border border-[#E8EAED] bg-[#F8F9FA] pl-10 pr-4 py-2.5 text-xs font-semibold text-[#181A1C] focus:border-[#181A1C] focus:bg-white focus:ring-1 focus:ring-[#181A1C] transition shadow-2xs"
            />
          </div>
          <button
            type="submit"
            className="rounded-2xl bg-[#181A1C] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#2A2E33] shadow-md transition"
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
              className={`rounded-xl px-4 py-1.5 text-xs font-bold transition-all whitespace-nowrap ${
                (statusFilter === tab.value || (!statusFilter && tab.value === 'ALL'))
                  ? 'bg-[#181A1C] text-white shadow-sm'
                  : 'bg-[#F8F9FA] text-[#6B7280] hover:text-[#181A1C] hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Onboarding Records Grid / Table */}
      {onboardingProcesses.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#E8EAED] bg-white p-12 text-center space-y-3">
          <UserCheck className="mx-auto h-10 w-10 text-[#9CA3AF]" />
          <h3 className="text-sm font-bold text-[#181A1C]">
            No Onboarding Records Found
          </h3>
          <p className="text-xs text-[#6B7280] max-w-sm mx-auto">
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
                className="rounded-3xl border border-[#E8EAED] bg-white p-6 shadow-2xs space-y-4 hover:shadow-md transition"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-[#181A1C]">
                        {applicant.firstName} {applicant.lastName}
                      </h4>
                      <span
                        className={`inline-flex items-center rounded-xl px-2.5 py-0.5 text-[10px] font-extrabold ${statusConfig.badgeBg} ${statusConfig.badgeText}`}
                      >
                        {statusConfig.label}
                      </span>
                    </div>
                    <p className="text-xs text-[#6B7280] mt-0.5">
                      {job.title} • {job.department}
                    </p>
                  </div>

                  <Link
                    href={`/dashboard/hiring/applicants/${proc.applicationId}`}
                    className="rounded-xl border border-[#E8EAED] bg-[#F8F9FA] px-3.5 py-1.5 text-xs font-bold text-[#181A1C] hover:bg-[#181A1C] hover:text-white transition shadow-2xs shrink-0 flex items-center gap-1"
                  >
                    <span>Detail</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {/* Dates & Timeline */}
                <div className="grid grid-cols-2 gap-2 text-[11px] rounded-2xl bg-[#F8F9FA] p-3.5 border border-[#E8EAED]">
                  <div className="space-y-0.5">
                    <span className="text-[#9CA3AF] uppercase tracking-wider font-bold text-[10px]">
                      Start Date
                    </span>
                    <p className="font-bold text-[#181A1C]">
                      {new Date(proc.startDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[#9CA3AF] uppercase tracking-wider font-bold text-[10px]">
                      Target Completion
                    </span>
                    <p className="font-bold text-[#181A1C]">
                      {proc.targetCompletionDate
                        ? new Date(proc.targetCompletionDate).toLocaleDateString()
                        : 'Open'}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-[#6B7280] text-[11px]">
                      Checklist Items: {progress.completedTasks} / {progress.totalTasks} Verified
                    </span>
                    <span className="text-[#181A1C]">
                      {progress.percentComplete}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F4F5F7]">
                    <div
                      className={`h-full transition-all duration-300 ${
                        progress.percentComplete === 100 ? 'bg-emerald-500' : 'bg-[#181A1C]'
                      }`}
                      style={{ width: `${progress.percentComplete}%` }}
                    />
                  </div>
                </div>

                {/* Task Breakdown Chips */}
                <div className="flex items-center justify-between text-[10px] text-[#6B7280] pt-2 border-t border-[#E8EAED]">
                  <span>{progress.verifiedCount} Verified</span>
                  {progress.submittedCount > 0 && (
                    <span className="text-amber-600 font-bold">{progress.submittedCount} Review Needed</span>
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
