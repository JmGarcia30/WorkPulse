import { formatStatusLabel } from '@/lib/ui/format-status';
import Link from 'next/link';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { ApplicationStatus } from '@prisma/client';
import { Users } from 'lucide-react';
import { HiringPageHeader } from '@/components/hiring/HiringPageHeader';
import { HiringFilterToolbar, FilterPill } from '@/components/hiring/HiringFilterToolbar';
import { HiringPagination } from '@/components/hiring/HiringPagination';
import { HiringCardWorkspace, WorkspaceCandidateItem } from '@/components/hiring/HiringCardWorkspace';

interface ApplicantsPageProps {
  searchParams: Promise<{
    status?: string;
    jobId?: string;
    search?: string;
    sort?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 9;

export default async function ApplicantsPage({ searchParams }: ApplicantsPageProps) {
  const user = await requireBackOfficeContext();

  const params = await searchParams;
  const statusFilter = params.status;
  const jobIdFilter = params.jobId;
  const searchQuery = params.search?.trim();
  const sort = params.sort || 'newest';

  // Validate pagination
  const rawPage = parseInt(params.page || '1', 10);
  const currentPage = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;

  // Sorting
  let orderByClause: Record<string, unknown> = { appliedAt: 'desc' };
  if (sort === 'oldest') {
    orderByClause = { appliedAt: 'asc' };
  } else if (sort === 'name_asc') {
    orderByClause = { applicant: { firstName: 'asc' } };
  } else if (sort === 'name_desc') {
    orderByClause = { applicant: { firstName: 'desc' } };
  }

  // Common where filter for isolation & search
  const whereClause = {
    job: {
      organizationId: user.organizationId,
      id: jobIdFilter || undefined,
    },
    status:
      statusFilter && statusFilter !== 'ALL' ? (statusFilter as ApplicationStatus) : undefined,
    OR: searchQuery
      ? [
        { applicant: { firstName: { contains: searchQuery, mode: 'insensitive' as const } } },
        { applicant: { lastName: { contains: searchQuery, mode: 'insensitive' as const } } },
        { applicant: { email: { contains: searchQuery, mode: 'insensitive' as const } } },
        { job: { title: { contains: searchQuery, mode: 'insensitive' as const } } },
      ]
      : undefined,
  };

  // Parallel server-side queries: Paginated Records + Total Count + Job Dropdowns + Stage Counters
  const [applications, totalCount, organizationJobs, stageCounts] = await Promise.all([
    prisma.application.findMany({
      where: whereClause,
      orderBy: orderByClause,
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        job: { select: { id: true, title: true, department: true } },
        applicant: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        documents: { select: { id: true, fileName: true } },
        recruitmentDocuments: { select: { id: true, type: true, status: true, fileName: true } },
      },
    }),
    prisma.application.count({ where: whereClause }),
    prisma.job.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, title: true, department: true },
      orderBy: { title: 'asc' },
    }),
    prisma.application.groupBy({
      by: ['status'],
      where: { job: { organizationId: user.organizationId } },
      _count: { _all: true },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

  // Build metric pills at top of toolbar
  const stageCountsMap = new Map<string, number>();
  let allOrgCandidates = 0;
  stageCounts.forEach((sc) => {
    stageCountsMap.set(sc.status, sc._count._all);
    allOrgCandidates += sc._count._all;
  });

  const baseParams = {
    ...(searchQuery ? { search: searchQuery } : {}),
    ...(jobIdFilter ? { jobId: jobIdFilter } : {}),
    ...(sort !== 'newest' ? { sort } : {}),
  };

  const metricPills: FilterPill[] = [
    {
      label: 'All Applicants',
      count: allOrgCandidates,
      value: 'ALL',
      isActive: !statusFilter || statusFilter === 'ALL',
      href: `/dashboard/hiring/applicants?${new URLSearchParams({ ...baseParams, status: 'ALL' }).toString()}`,
    },
    {
      label: 'Screening',
      count: stageCountsMap.get(ApplicationStatus.SCREENING) || 0,
      value: ApplicationStatus.SCREENING,
      isActive: statusFilter === ApplicationStatus.SCREENING,
      href: `/dashboard/hiring/applicants?${new URLSearchParams({ ...baseParams, status: ApplicationStatus.SCREENING }).toString()}`,
    },
    {
      label: 'Shortlisted',
      count: stageCountsMap.get(ApplicationStatus.SHORTLISTED) || 0,
      value: ApplicationStatus.SHORTLISTED,
      isActive: statusFilter === ApplicationStatus.SHORTLISTED,
      href: `/dashboard/hiring/applicants?${new URLSearchParams({ ...baseParams, status: ApplicationStatus.SHORTLISTED }).toString()}`,
    },
    {
      label: 'Interview',
      count: stageCountsMap.get(ApplicationStatus.INTERVIEW) || 0,
      value: ApplicationStatus.INTERVIEW,
      isActive: statusFilter === ApplicationStatus.INTERVIEW,
      href: `/dashboard/hiring/applicants?${new URLSearchParams({ ...baseParams, status: ApplicationStatus.INTERVIEW }).toString()}`,
    },
    {
      label: 'Offer',
      count: stageCountsMap.get(ApplicationStatus.OFFER) || 0,
      value: ApplicationStatus.OFFER,
      isActive: statusFilter === ApplicationStatus.OFFER,
      href: `/dashboard/hiring/applicants?${new URLSearchParams({ ...baseParams, status: ApplicationStatus.OFFER }).toString()}`,
    },
    {
      label: 'Hired',
      count: stageCountsMap.get(ApplicationStatus.HIRED) || 0,
      value: ApplicationStatus.HIRED,
      isActive: statusFilter === ApplicationStatus.HIRED,
      href: `/dashboard/hiring/applicants?${new URLSearchParams({ ...baseParams, status: ApplicationStatus.HIRED }).toString()}`,
    },
  ];

  // Map database application items to Workspace candidate items
  const candidateItems: WorkspaceCandidateItem[] = applications.map((app) => {
    const fullName = `${app.applicant.firstName} ${app.applicant.lastName}`;
    const initials = `${app.applicant.firstName[0] || ''}${app.applicant.lastName[0] || ''}`.toUpperCase();

    // Prepare checklist of documents
    const checklist = app.recruitmentDocuments.map((doc) => ({
      id: doc.id,
      title: doc.type.replace(/_/g, ' '),
      subtitle: doc.status.replace(/_/g, ' '),
      isComplete: doc.status === 'VERIFIED',
    }));

    return {
      id: app.id,
      applicationId: app.id,
      name: fullName,
      position: app.job.title,
      email: app.applicant.email,
      phone: app.applicant.phone,
      department: app.job.department,
      appliedDate: new Date(app.appliedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      status: app.status,
      statusLabel: formatStatusLabel(app.status),
      avatarInitials: initials,
      coverLetter: app.coverLetter || undefined,
      workflowInfo:
        app.documents.length > 0
          ? `${app.documents.length} Resume/Document${app.documents.length === 1 ? '' : 's'} on file`
          : 'Application Submitted',
      workflowIcon: 'document',
      checklistTitle: 'Recruitment Document Checklist',
      checklist: checklist.length > 0 ? checklist : undefined,
      stageDetails: [
        { label: 'Application ID', value: `#${app.id.slice(0, 8)}` },
        { label: 'Role Department', value: app.job.department },
        { label: 'Stage Progression', value: formatStatusLabel(app.status) },
      ],
      workflowTabLabel: 'Documents',
    };
  });

  return (
    <div className="space-y-6">
      {/* Header with Breadcrumb and Title */}
      <HiringPageHeader
        breadcrumbs={[
          { label: 'Hiring', href: '/dashboard/hiring/pipeline' },
          { label: 'Applicants' },
        ]}
        title="Candidate Applicants"
        badge={
          <span className="flex h-5 items-center justify-center rounded-full bg-slate-100 px-2 text-[11px] font-bold text-slate-700 border border-slate-200/80 tabular-nums">
            {totalCount} Total
          </span>
        }
        description="Review candidate applications across organization postings with detail inspector."
        actions={
          <Link
            href="/dashboard/hiring/pipeline"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs"
          >
            <Users className="h-3.5 w-3.5 text-slate-400" />
            <span>Pipeline Kanban</span>
          </Link>
        }
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
          ...Object.values(ApplicationStatus).map((st) => ({
            value: st,
            label: formatStatusLabel(st),
          })),
        ]}
        metricPills={metricPills}
        searchPlaceholder="Search applicants by name, role, or email..."
        baseUrl="/dashboard/hiring/applicants"
      />

      {/* Responsive Card Grid with Candidate Detail Panel and Server Pagination */}
      <HiringCardWorkspace
        candidates={candidateItems}
        showDivider
        emptyMessage="No candidate applicants found matching your search and filter criteria."
        pagination={
          <HiringPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={PAGE_SIZE}
            itemLabel="applicants"
            baseUrl="/dashboard/hiring/applicants"
            searchParams={{
              ...(searchQuery ? { search: searchQuery } : {}),
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
