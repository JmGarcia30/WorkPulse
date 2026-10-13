import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { canViewHiringData } from '@/lib/permissions/rbac';
import { OnboardingStatus, OnboardingTaskStatus } from '@prisma/client';
import { ErrorState } from '@/components/ui/ErrorState';
import { UserCheck } from 'lucide-react';
import { HiringPageHeader } from '@/components/hiring/HiringPageHeader';
import { HiringFilterToolbar, FilterPill } from '@/components/hiring/HiringFilterToolbar';
import { HiringPagination } from '@/components/hiring/HiringPagination';
import { HiringCardWorkspace, WorkspaceCandidateItem } from '@/components/hiring/HiringCardWorkspace';
import { formatStatusLabel } from '@/lib/ui/format-status';

interface OnboardingPageProps {
  searchParams: Promise<{
    search?: string;
    jobId?: string;
    status?: string;
    sort?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 9;

export default async function OnboardingManagementPage({
  searchParams,
}: OnboardingPageProps) {
  const user = await getSession();
  if (!user || !canViewHiringData(user)) {
    return (
      <ErrorState
        title="Access Denied"
        message="You do not have permission to view organization onboarding processes."
      />
    );
  }

  const params = await searchParams;
  const search = params.search?.trim();
  const jobIdFilter = params.jobId;
  const statusFilter = params.status;
  const sort = params.sort || 'newest';

  // Validate pagination
  const rawPage = parseInt(params.page || '1', 10);
  const currentPage = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;

  // Sorting
  let orderByClause: Record<string, unknown> = { startDate: 'desc' };
  if (sort === 'oldest') {
    orderByClause = { startDate: 'asc' };
  } else if (sort === 'name_asc') {
    orderByClause = { application: { applicant: { firstName: 'asc' } } };
  } else if (sort === 'name_desc') {
    orderByClause = { application: { applicant: { firstName: 'desc' } } };
  }

  // Common where clause enforcing tenant isolation
  const whereClause = {
    application: {
      job: {
        organizationId: user.organizationId,
        id: jobIdFilter || undefined,
      },
      OR: search
        ? [
            { applicant: { firstName: { contains: search, mode: 'insensitive' as const } } },
            { applicant: { lastName: { contains: search, mode: 'insensitive' as const } } },
            { applicant: { email: { contains: search, mode: 'insensitive' as const } } },
            { job: { title: { contains: search, mode: 'insensitive' as const } } },
          ]
        : undefined,
    },
    status:
      statusFilter && statusFilter !== 'ALL'
        ? (statusFilter as OnboardingStatus)
        : undefined,
  };

  // Parallel Queries: Paginated Onboarding Records, Total Count, Jobs, Status Counts
  const [onboardingProcesses, totalCount, organizationJobs, statusCounts] = await Promise.all([
    prisma.onboardingProcess.findMany({
      where: whereClause,
      orderBy: orderByClause,
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        application: {
          include: {
            applicant: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
            job: { select: { id: true, title: true, department: true } },
            employee: { select: { id: true, employeeStatus: true } },
          },
        },
        tasks: {
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
    prisma.onboardingProcess.count({ where: whereClause }),
    prisma.job.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, title: true, department: true },
      orderBy: { title: 'asc' },
    }),
    prisma.onboardingProcess.groupBy({
      by: ['status'],
      where: { application: { job: { organizationId: user.organizationId } } },
      _count: { _all: true },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

  // Build Status Counts Map
  const statusCountsMap = new Map<string, number>();
  let allOrgProcesses = 0;
  statusCounts.forEach((sc) => {
    statusCountsMap.set(sc.status, sc._count._all);
    allOrgProcesses += sc._count._all;
  });

  const baseParams = {
    ...(search ? { search } : {}),
    ...(jobIdFilter ? { jobId: jobIdFilter } : {}),
    ...(sort !== 'newest' ? { sort } : {}),
  };

  const metricPills: FilterPill[] = [
    {
      label: 'All Onboarding',
      count: allOrgProcesses,
      value: 'ALL',
      isActive: !statusFilter || statusFilter === 'ALL',
      href: `/dashboard/hiring/onboarding?${new URLSearchParams({ ...baseParams, status: 'ALL' }).toString()}`,
    },
    {
      label: 'Not Started',
      count: statusCountsMap.get(OnboardingStatus.NOT_STARTED) || 0,
      value: OnboardingStatus.NOT_STARTED,
      isActive: statusFilter === OnboardingStatus.NOT_STARTED,
      href: `/dashboard/hiring/onboarding?${new URLSearchParams({ ...baseParams, status: OnboardingStatus.NOT_STARTED }).toString()}`,
    },
    {
      label: 'In Progress',
      count: statusCountsMap.get(OnboardingStatus.IN_PROGRESS) || 0,
      value: OnboardingStatus.IN_PROGRESS,
      isActive: statusFilter === OnboardingStatus.IN_PROGRESS,
      href: `/dashboard/hiring/onboarding?${new URLSearchParams({ ...baseParams, status: OnboardingStatus.IN_PROGRESS }).toString()}`,
    },
    {
      label: 'Completed',
      count: statusCountsMap.get(OnboardingStatus.COMPLETED) || 0,
      value: OnboardingStatus.COMPLETED,
      isActive: statusFilter === OnboardingStatus.COMPLETED,
      href: `/dashboard/hiring/onboarding?${new URLSearchParams({ ...baseParams, status: OnboardingStatus.COMPLETED }).toString()}`,
    },
  ];

  // Map database onboarding items to Workspace candidate items
  const candidateItems: WorkspaceCandidateItem[] = onboardingProcesses.map((proc) => {
    const fullName = `${proc.application.applicant.firstName} ${proc.application.applicant.lastName}`;
    const initials = `${proc.application.applicant.firstName[0] || ''}${proc.application.applicant.lastName[0] || ''}`.toUpperCase();

    const verifiedTasksCount = proc.tasks.filter((t) => t.status === OnboardingTaskStatus.VERIFIED).length;
    const submittedTasksCount = proc.tasks.filter((t) => t.status === OnboardingTaskStatus.SUBMITTED).length;
    const totalTasks = proc.tasks.length;
    const progressPct = totalTasks > 0 ? Math.round((verifiedTasksCount / totalTasks) * 100) : 0;

    const checklist = proc.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      subtitle: `${formatStatusLabel(task.status)}${task.isRequired ? ' • Mandatory' : ' • Optional'}`,
      isComplete: task.status === OnboardingTaskStatus.VERIFIED,
    }));

    return {
      id: proc.id,
      applicationId: proc.application.id,
      name: fullName,
      position: proc.application.job.title,
      email: proc.application.applicant.email,
      phone: proc.application.applicant.phone,
      department: proc.application.job.department,
      appliedDate: new Date(proc.startDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      status: proc.status,
      statusLabel: formatStatusLabel(proc.status),
      avatarInitials: initials,
      workflowInfo: `${verifiedTasksCount}/${totalTasks} Tasks Verified (${progressPct}%)`,
      workflowIcon: 'checklist',
      checklistTitle: `Onboarding Checklist (${verifiedTasksCount} of ${totalTasks} completed)`,
      checklist,
      stageDetails: [
        { label: 'Target Start Date', value: new Date(proc.startDate).toLocaleDateString() },
        { label: 'Checklist Progress', value: `${verifiedTasksCount} / ${totalTasks} (${progressPct}%)` },
        { label: 'Awaiting Verification', value: `${submittedTasksCount} tasks` },
        {
          label: 'Hired Employee Link',
          value: proc.application.employee ? 'Created in Directory' : 'Pending Conversion',
        },
      ],
      workflowTabLabel: 'Onboarding',
    };
  });

  return (
    <div className="space-y-6">
      {/* Header with Breadcrumb and Title */}
      <HiringPageHeader
        breadcrumbs={[
          { label: 'Hiring', href: '/dashboard/hiring/pipeline' },
          { label: 'Onboarding' },
        ]}
        title={
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-slate-700" />
            <span>Onboarding</span>
          </div>
        }
        badge={
          <span className="flex h-5 items-center justify-center rounded-full bg-slate-100 px-2 text-[11px] font-bold text-slate-700 border border-slate-200/80 tabular-nums">
            {totalCount} Total
          </span>
        }
        description="Track hired candidates, verify pre-employment clearance documents, and manage Day 1 institutional readiness."
      />

      {/* Filter Toolbar */}
      <HiringFilterToolbar
        searchQuery={search}
        selectedJobId={jobIdFilter}
        selectedStatus={statusFilter}
        selectedSort={sort}
        jobs={organizationJobs}
        statuses={[
          { value: 'ALL', label: 'All Statuses' },
          ...Object.values(OnboardingStatus).map((st) => ({
            value: st,
            label: formatStatusLabel(st),
          })),
        ]}
        metricPills={metricPills}
        searchPlaceholder="Search new hire by name, role, or email..."
        baseUrl="/dashboard/hiring/onboarding"
      />

      {/* Responsive Card Grid with Candidate Detail Panel and Server Pagination */}
      <HiringCardWorkspace
        candidates={candidateItems}
        emptyMessage="No candidates currently in onboarding matching your filter criteria."
        pagination={
          <HiringPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={PAGE_SIZE}
            itemLabel="candidates"
            baseUrl="/dashboard/hiring/onboarding"
            searchParams={{
              ...(search ? { search } : {}),
              ...(jobIdFilter ? { jobId: jobIdFilter } : {}),
              ...(statusFilter ? { status: statusFilter } : {}),
              ...(sort !== 'newest' ? { sort } : {}),
            }}
          />
        }
      />
    </div>
  );
}
