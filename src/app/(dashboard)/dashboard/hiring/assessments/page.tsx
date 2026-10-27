import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { canViewHiringData } from '@/lib/permissions/rbac';
import { AssessmentStatus, AssessmentType } from '@prisma/client';
import { ErrorState } from '@/components/ui/ErrorState';
import { Award } from 'lucide-react';
import { HiringPageHeader } from '@/components/hiring/HiringPageHeader';
import { HiringFilterToolbar, FilterPill } from '@/components/hiring/HiringFilterToolbar';
import { HiringPagination } from '@/components/hiring/HiringPagination';
import { HiringCardWorkspace, WorkspaceCandidateItem } from '@/components/hiring/HiringCardWorkspace';
import { formatStatusLabel } from '@/lib/ui/format-status';

interface AssessmentsPageProps {
  searchParams: Promise<{
    status?: string;
    type?: string;
    jobId?: string;
    search?: string;
    sort?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 9;

export default async function AssessmentsPage({ searchParams }: AssessmentsPageProps) {
  const user = await getSession();
  if (!user) return null;

  if (!canViewHiringData(user)) {
    return (
      <ErrorState
        title="Access Denied"
        message="You do not have permission to view organization assessments."
      />
    );
  }

  const params = await searchParams;
  const statusFilter = params.status;
  const typeFilter = params.type;
  const jobIdFilter = params.jobId;
  const searchQuery = params.search?.trim();
  const sort = params.sort || 'newest';

  // Validate pagination
  const rawPage = parseInt(params.page || '1', 10);
  const currentPage = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;

  // Sorting
  let orderByClause: Record<string, unknown> = { createdAt: 'desc' };
  if (sort === 'oldest') {
    orderByClause = { createdAt: 'asc' };
  } else if (sort === 'name_asc') {
    orderByClause = { application: { applicant: { firstName: 'asc' } } };
  } else if (sort === 'name_desc') {
    orderByClause = { application: { applicant: { firstName: 'desc' } } };
  }

  // Where filter enforcing multi-tenant isolation
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
    title: searchQuery && !searchQuery.includes('@') ? { contains: searchQuery, mode: 'insensitive' as const } : undefined,
    status:
      statusFilter && statusFilter !== 'ALL' ? (statusFilter as AssessmentStatus) : undefined,
    type:
      typeFilter && typeFilter !== 'ALL' ? (typeFilter as AssessmentType) : undefined,
  };

  // Parallel Queries: Paginated Assessments, Total Count, Jobs, Status Counts
  const [assessments, totalCount, organizationJobs, statusCounts] = await Promise.all([
    prisma.assessment.findMany({
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
        evaluator: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    }),
    prisma.assessment.count({ where: whereClause }),
    prisma.job.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, title: true, department: true },
      orderBy: { title: 'asc' },
    }),
    prisma.assessment.groupBy({
      by: ['status'],
      where: { application: { job: { organizationId: user.organizationId } } },
      _count: { _all: true },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

  // Build Status Counts Map
  const statusCountsMap = new Map<string, number>();
  let allOrgAssessments = 0;
  statusCounts.forEach((sc) => {
    statusCountsMap.set(sc.status, sc._count._all);
    allOrgAssessments += sc._count._all;
  });

  const baseParams = {
    ...(searchQuery ? { search: searchQuery } : {}),
    ...(jobIdFilter ? { jobId: jobIdFilter } : {}),
    ...(typeFilter ? { type: typeFilter } : {}),
    ...(sort !== 'newest' ? { sort } : {}),
  };

  const metricPills: FilterPill[] = [
    {
      label: 'All Assessments',
      count: allOrgAssessments,
      value: 'ALL',
      isActive: !statusFilter || statusFilter === 'ALL',
      href: `/dashboard/hiring/assessments?${new URLSearchParams({ ...baseParams, status: 'ALL' }).toString()}`,
    },
    {
      label: 'Assigned',
      count: statusCountsMap.get(AssessmentStatus.ASSIGNED) || 0,
      value: AssessmentStatus.ASSIGNED,
      isActive: statusFilter === AssessmentStatus.ASSIGNED,
      href: `/dashboard/hiring/assessments?${new URLSearchParams({ ...baseParams, status: AssessmentStatus.ASSIGNED }).toString()}`,
    },
    {
      label: 'In Progress',
      count: statusCountsMap.get(AssessmentStatus.IN_PROGRESS) || 0,
      value: AssessmentStatus.IN_PROGRESS,
      isActive: statusFilter === AssessmentStatus.IN_PROGRESS,
      href: `/dashboard/hiring/assessments?${new URLSearchParams({ ...baseParams, status: AssessmentStatus.IN_PROGRESS }).toString()}`,
    },
    {
      label: 'Submitted',
      count: statusCountsMap.get(AssessmentStatus.SUBMITTED) || 0,
      value: AssessmentStatus.SUBMITTED,
      isActive: statusFilter === AssessmentStatus.SUBMITTED,
      href: `/dashboard/hiring/assessments?${new URLSearchParams({ ...baseParams, status: AssessmentStatus.SUBMITTED }).toString()}`,
    },
    {
      label: 'Passed',
      count: statusCountsMap.get(AssessmentStatus.PASSED) || 0,
      value: AssessmentStatus.PASSED,
      isActive: statusFilter === AssessmentStatus.PASSED,
      href: `/dashboard/hiring/assessments?${new URLSearchParams({ ...baseParams, status: AssessmentStatus.PASSED }).toString()}`,
    },
    {
      label: 'Failed',
      count: statusCountsMap.get(AssessmentStatus.FAILED) || 0,
      value: AssessmentStatus.FAILED,
      isActive: statusFilter === AssessmentStatus.FAILED,
      href: `/dashboard/hiring/assessments?${new URLSearchParams({ ...baseParams, status: AssessmentStatus.FAILED }).toString()}`,
    },
  ];

  // Map database assessment items to Workspace candidate items
  const candidateItems: WorkspaceCandidateItem[] = assessments.map((ass) => {
    const fullName = `${ass.application.applicant.firstName} ${ass.application.applicant.lastName}`;
    const initials = `${ass.application.applicant.firstName[0] || ''}${ass.application.applicant.lastName[0] || ''}`.toUpperCase();

    const checklist = [
      {
        id: 'assigned',
        title: 'Task Assigned',
        subtitle: ass.title,
        isComplete: true,
      },
      {
        id: 'submitted',
        title: 'Candidate Submission',
        subtitle:
          ass.status === AssessmentStatus.ASSIGNED
            ? 'Awaiting submission'
            : 'Submitted for evaluation',
        isComplete:
          ass.status === AssessmentStatus.SUBMITTED ||
          ass.status === AssessmentStatus.UNDER_REVIEW ||
          ass.status === AssessmentStatus.PASSED ||
          ass.status === AssessmentStatus.FAILED,
      },
      {
        id: 'evaluated',
        title: 'Faculty / HR Evaluation',
        subtitle:
          ass.score !== null
            ? `Score Recorded: ${ass.score} / ${ass.passingScore} (Threshold)`
            : 'Pending evaluation',
        isComplete: ass.score !== null,
      },
      {
        id: 'passed',
        title: 'Final Outcome',
        subtitle:
          ass.status === AssessmentStatus.PASSED
            ? 'Candidate Passed'
            : ass.status === AssessmentStatus.FAILED
              ? 'Candidate Below Threshold'
              : 'Pending final review',
        isComplete: ass.status === AssessmentStatus.PASSED,
      },
    ];

    return {
      id: ass.id,
      applicationId: ass.application.id,
      name: fullName,
      position: ass.application.job.title,
      email: ass.application.applicant.email,
      phone: ass.application.applicant.phone,
      department: ass.application.job.department,
      appliedDate: new Date(ass.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      status: ass.status,
      statusLabel: formatStatusLabel(ass.status),
      avatarInitials: initials,
      workflowInfo: `${ass.type.replace(/_/g, ' ')} • ${ass.score !== null ? `Score ${ass.score}/${ass.passingScore}` : 'Awaiting Review'}`,
      workflowIcon: 'checklist',
      checklistTitle: 'Assessment Progress & Evaluation',
      checklist,
      stageDetails: [
        { label: 'Assessment Test', value: ass.title },
        { label: 'Assessment Type', value: ass.type.replace(/_/g, ' ') },
        { label: 'Passing Threshold', value: `${ass.passingScore} pts` },
        {
          label: 'Candidate Score',
          value: ass.score !== null ? `${ass.score} pts` : 'Not recorded',
        },
        {
          label: 'Assigned Evaluator',
          value: ass.evaluator ? ass.evaluator.name : 'Unassigned',
        },
        ...(ass.reviewerNotes
          ? [{ label: 'Evaluator Remarks', value: ass.reviewerNotes }]
          : []),
      ],
      workflowTabLabel: 'Assessment',
    };
  });

  return (
    <div className="space-y-6">
      {/* Header with Breadcrumb and Title */}
      <HiringPageHeader
        breadcrumbs={[
          { label: 'Hiring', href: '/dashboard/hiring/pipeline' },
          { label: 'Assessments' },
        ]}
        title={
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-slate-700" />
            <span>Pre-Employment Assessment Center</span>
          </div>
        }
        badge={
          <span className="flex h-5 items-center justify-center rounded-full bg-slate-100 px-2 text-[11px] font-bold text-slate-700 border border-slate-200/80 tabular-nums">
            {totalCount} Total
          </span>
        }
        description="Monitor candidate technical tests, skill challenges, and evaluation outcomes."
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
          ...Object.values(AssessmentStatus).map((st) => ({
            value: st,
            label: formatStatusLabel(st),
          })),
        ]}
        metricPills={metricPills}
        searchPlaceholder="Search candidate or assessment title..."
        baseUrl="/dashboard/hiring/assessments"
      />

      {/* Responsive Card Grid with Candidate Detail Panel and Server Pagination */}
      <HiringCardWorkspace
        candidates={candidateItems}
        emptyMessage="No pre-employment assessments found matching your filter criteria."
        pagination={
          <HiringPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={PAGE_SIZE}
            itemLabel="assessments"
            baseUrl="/dashboard/hiring/assessments"
            searchParams={{
              ...(searchQuery ? { search: searchQuery } : {}),
              ...(jobIdFilter ? { jobId: jobIdFilter } : {}),
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
