import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { canViewHiringData } from '@/lib/permissions/rbac';
import { InterviewStatus, InterviewType } from '@prisma/client';
import { ErrorState } from '@/components/ui/ErrorState';
import { Calendar } from 'lucide-react';
import { HiringPageHeader } from '@/components/hiring/HiringPageHeader';
import { HiringFilterToolbar, FilterPill } from '@/components/hiring/HiringFilterToolbar';
import { HiringPagination } from '@/components/hiring/HiringPagination';
import { HiringCardWorkspace, WorkspaceCandidateItem } from '@/components/hiring/HiringCardWorkspace';
import { formatStatusLabel } from '@/lib/ui/format-status';

interface InterviewsPageProps {
  searchParams: Promise<{
    status?: string;
    type?: string;
    jobId?: string;
    interviewerId?: string;
    search?: string;
    sort?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 9;

export default async function InterviewsPage({ searchParams }: InterviewsPageProps) {
  const user = await getSession();
  if (!user) return null;

  if (!canViewHiringData(user)) {
    return (
      <ErrorState
        title="Access Denied"
        message="You do not have permission to view organization interviews."
      />
    );
  }

  const params = await searchParams;
  const statusFilter = params.status;
  const typeFilter = params.type;
  const jobIdFilter = params.jobId;
  const interviewerIdFilter = params.interviewerId;
  const searchQuery = params.search?.trim();
  const sort = params.sort || 'newest';

  // Validate pagination
  const rawPage = parseInt(params.page || '1', 10);
  const currentPage = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;

  // Sorting
  let orderByClause: Record<string, unknown> = { scheduledAt: 'desc' };
  if (sort === 'oldest') {
    orderByClause = { scheduledAt: 'asc' };
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
      OR: searchQuery
        ? [
            { applicant: { firstName: { contains: searchQuery, mode: 'insensitive' as const } } },
            { applicant: { lastName: { contains: searchQuery, mode: 'insensitive' as const } } },
            { applicant: { email: { contains: searchQuery, mode: 'insensitive' as const } } },
            { job: { title: { contains: searchQuery, mode: 'insensitive' as const } } },
          ]
        : undefined,
    },
    interviewerId: interviewerIdFilter || undefined,
    status:
      statusFilter && statusFilter !== 'ALL' ? (statusFilter as InterviewStatus) : undefined,
    type:
      typeFilter && typeFilter !== 'ALL' ? (typeFilter as InterviewType) : undefined,
  };

  // Parallel Queries: Paginated Interviews, Total Count, Jobs, Interviewers, Status Counts
  const [interviews, totalCount, organizationJobs, statusCounts] = await Promise.all([
    prisma.interview.findMany({
      where: whereClause,
      orderBy: orderByClause,
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        application: {
          include: {
            applicant: {
              select: { id: true, firstName: true, lastName: true, email: true, phone: true },
            },
            job: {
              select: { id: true, title: true, department: true },
            },
          },
        },
        interviewer: {
          select: { id: true, name: true, email: true, role: true },
        },
        evaluation: {
          select: {
            id: true,
            overallScore: true,
            recommendation: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.interview.count({ where: whereClause }),
    prisma.job.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, title: true, department: true },
      orderBy: { title: 'asc' },
    }),
    prisma.interview.groupBy({
      by: ['status'],
      where: { application: { job: { organizationId: user.organizationId } } },
      _count: { _all: true },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

  // Build Status Counts Map
  const statusCountsMap = new Map<string, number>();
  let allOrgInterviews = 0;
  statusCounts.forEach((sc) => {
    statusCountsMap.set(sc.status, sc._count._all);
    allOrgInterviews += sc._count._all;
  });

  const baseParams = {
    ...(searchQuery ? { search: searchQuery } : {}),
    ...(jobIdFilter ? { jobId: jobIdFilter } : {}),
    ...(interviewerIdFilter ? { interviewerId: interviewerIdFilter } : {}),
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(sort !== 'newest' ? { sort } : {}),
  };

  const metricPills: FilterPill[] = [
    {
      label: 'All Interviews',
      count: allOrgInterviews,
      value: 'ALL',
      isActive: !statusFilter || statusFilter === 'ALL',
      href: `/dashboard/hiring/interviews?${new URLSearchParams({ ...baseParams, status: 'ALL' }).toString()}`,
    },
    {
      label: 'Scheduled',
      count: statusCountsMap.get(InterviewStatus.SCHEDULED) || 0,
      value: InterviewStatus.SCHEDULED,
      isActive: statusFilter === InterviewStatus.SCHEDULED,
      href: `/dashboard/hiring/interviews?${new URLSearchParams({ ...baseParams, status: InterviewStatus.SCHEDULED }).toString()}`,
    },
    {
      label: 'Completed',
      count: statusCountsMap.get(InterviewStatus.COMPLETED) || 0,
      value: InterviewStatus.COMPLETED,
      isActive: statusFilter === InterviewStatus.COMPLETED,
      href: `/dashboard/hiring/interviews?${new URLSearchParams({ ...baseParams, status: InterviewStatus.COMPLETED }).toString()}`,
    },
    {
      label: 'Cancelled',
      count: statusCountsMap.get(InterviewStatus.CANCELLED) || 0,
      value: InterviewStatus.CANCELLED,
      isActive: statusFilter === InterviewStatus.CANCELLED,
      href: `/dashboard/hiring/interviews?${new URLSearchParams({ ...baseParams, status: InterviewStatus.CANCELLED }).toString()}`,
    },
    {
      label: 'No Show',
      count: statusCountsMap.get(InterviewStatus.NO_SHOW) || 0,
      value: InterviewStatus.NO_SHOW,
      isActive: statusFilter === InterviewStatus.NO_SHOW,
      href: `/dashboard/hiring/interviews?${new URLSearchParams({ ...baseParams, status: InterviewStatus.NO_SHOW }).toString()}`,
    },
  ];

  // Map to Workspace candidate items
  const candidateItems: WorkspaceCandidateItem[] = interviews.map((iv) => {
    const fullName = `${iv.application.applicant.firstName} ${iv.application.applicant.lastName}`;
    const initials = `${iv.application.applicant.firstName[0] || ''}${iv.application.applicant.lastName[0] || ''}`.toUpperCase();
    const scheduledDate = new Date(iv.scheduledAt);

    const checklist = [
      {
        id: 'scheduled',
        title: 'Interview Scheduled',
        subtitle: `${scheduledDate.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at ${scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        isComplete: true,
      },
      {
        id: 'evaluator',
        title: 'Interviewer Assigned',
        subtitle: `${iv.interviewer.name} (${iv.interviewer.role.replace(/_/g, ' ')})`,
        isComplete: Boolean(iv.interviewerId),
      },
      {
        id: 'completed',
        title: 'Session Conducted',
        subtitle: iv.status === InterviewStatus.COMPLETED ? 'Completed' : `Status: ${iv.status}`,
        isComplete: iv.status === InterviewStatus.COMPLETED,
      },
      {
        id: 'evaluation',
        title: 'Evaluation Result Recorded',
        subtitle: iv.evaluation
          ? `Score: ${iv.evaluation.overallScore.toFixed(1)}/5.0 • ${iv.evaluation.recommendation.replace(/_/g, ' ')}`
          : 'Pending evaluation review',
        isComplete: Boolean(iv.evaluation),
      },
    ];

    return {
      id: iv.id,
      applicationId: iv.application.id,
      name: fullName,
      position: iv.application.job.title,
      email: iv.application.applicant.email,
      phone: iv.application.applicant.phone,
      department: iv.application.job.department,
      appliedDate: scheduledDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      status: iv.status,
      statusLabel: formatStatusLabel(iv.status),
      avatarInitials: initials,
      workflowInfo: `${iv.type.replace(/_/g, ' ')} • ${scheduledDate.toLocaleDateString([], { month: 'short', day: 'numeric' })} (${iv.durationMinutes}m)`,
      workflowIcon: 'calendar',
      checklistTitle: 'Interview Evaluation Milestones',
      checklist,
      stageDetails: [
        { label: 'Interview Type', value: iv.type.replace(/_/g, ' ') },
        { label: 'Assigned Evaluator', value: iv.interviewer.name },
        {
          label: 'Scheduled Time',
          value: `${scheduledDate.toLocaleDateString()} ${scheduledDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        },
        { label: 'Duration', value: `${iv.durationMinutes} minutes` },
        {
          label: 'Score & Recommendation',
          value: iv.evaluation
            ? `${iv.evaluation.overallScore.toFixed(1)}/5.0 (${iv.evaluation.recommendation.replace(/_/g, ' ')})`
            : 'Awaiting Evaluation',
        },
      ],
      workflowTabLabel: 'Interview',
    };
  });

  return (
    <div className="space-y-6">
      {/* Header with Breadcrumb and Title */}
      <HiringPageHeader
        breadcrumbs={[
          { label: 'Hiring', href: '/dashboard/hiring/pipeline' },
          { label: 'Interviews' },
        ]}
        title={
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-slate-700" />
            <span>Interview Management Center</span>
          </div>
        }
        badge={
          <span className="flex h-5 items-center justify-center rounded-full bg-slate-100 px-2 text-[11px] font-bold text-slate-700 border border-slate-200/80 tabular-nums">
            {totalCount} Total
          </span>
        }
        description="Coordinate candidate interviews, review schedules, and track evaluation outcomes."
      />

      {/* Filter Toolbar */}
      <HiringFilterToolbar
        searchQuery={searchQuery}
        selectedJobId={jobIdFilter}
        selectedStatus={statusFilter}
        selectedSort={sort}
        jobs={organizationJobs}
        statuses={[
          { value: 'ALL', label: 'All Statuses' },
          ...Object.values(InterviewStatus).map((st) => ({
            value: st,
            label: formatStatusLabel(st),
          })),
        ]}
        metricPills={metricPills}
        searchPlaceholder="Search candidate name, role, or email..."
        baseUrl="/dashboard/hiring/interviews"
      />

      {/* Responsive Card Grid with Candidate Detail Panel and Server Pagination */}
      <HiringCardWorkspace
        candidates={candidateItems}
        emptyMessage="No candidate interviews found matching your filter criteria."
        pagination={
          <HiringPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={PAGE_SIZE}
            itemLabel="interviews"
            baseUrl="/dashboard/hiring/interviews"
            searchParams={{
              ...(searchQuery ? { search: searchQuery } : {}),
              ...(jobIdFilter ? { jobId: jobIdFilter } : {}),
              ...(interviewerIdFilter ? { interviewerId: interviewerIdFilter } : {}),
              ...(typeFilter ? { type: typeFilter } : {}),
              ...(statusFilter ? { status: statusFilter } : {}),
              ...(sort !== 'newest' ? { sort } : {}),
            }}
          />
        }
      />
    </div>
  );
}
