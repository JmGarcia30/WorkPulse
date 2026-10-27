import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { canViewHiringData } from '@/lib/permissions/rbac';
import { OfferStatus } from '@prisma/client';
import { ErrorState } from '@/components/ui/ErrorState';
import { FileText } from 'lucide-react';
import { HiringPageHeader } from '@/components/hiring/HiringPageHeader';
import { HiringFilterToolbar, FilterPill } from '@/components/hiring/HiringFilterToolbar';
import { HiringPagination } from '@/components/hiring/HiringPagination';
import { HiringCardWorkspace, WorkspaceCandidateItem } from '@/components/hiring/HiringCardWorkspace';
import { formatStatusLabel } from '@/lib/ui/format-status';

interface OffersPageProps {
  searchParams: Promise<{
    status?: string;
    jobId?: string;
    search?: string;
    sort?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 9;

export default async function OffersPage({ searchParams }: OffersPageProps) {
  const user = await getSession();
  if (!user) return null;

  if (!canViewHiringData(user)) {
    return (
      <ErrorState
        title="Access Denied"
        message="You do not have permission to view organization offers."
      />
    );
  }

  const params = await searchParams;
  const statusFilter = params.status;
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

  // Where clause enforcing tenant isolation
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
    status:
      statusFilter && statusFilter !== 'ALL' ? (statusFilter as OfferStatus) : undefined,
  };

  // Parallel Queries: Paginated Offers, Total Count, Jobs, Status Counts
  const [offers, totalCount, organizationJobs, statusCounts] = await Promise.all([
    prisma.offer.findMany({
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
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
        approvedBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    }),
    prisma.offer.count({ where: whereClause }),
    prisma.job.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, title: true, department: true },
      orderBy: { title: 'asc' },
    }),
    prisma.offer.groupBy({
      by: ['status'],
      where: { application: { job: { organizationId: user.organizationId } } },
      _count: { _all: true },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

  // Build Status Counts Map
  const statusCountsMap = new Map<string, number>();
  let allOrgOffers = 0;
  statusCounts.forEach((sc) => {
    statusCountsMap.set(sc.status, sc._count._all);
    allOrgOffers += sc._count._all;
  });

  const baseParams = {
    ...(searchQuery ? { search: searchQuery } : {}),
    ...(jobIdFilter ? { jobId: jobIdFilter } : {}),
    ...(sort !== 'newest' ? { sort } : {}),
  };

  const metricPills: FilterPill[] = [
    {
      label: 'All Offers',
      count: allOrgOffers,
      value: 'ALL',
      isActive: !statusFilter || statusFilter === 'ALL',
      href: `/dashboard/hiring/offers?${new URLSearchParams({ ...baseParams, status: 'ALL' }).toString()}`,
    },
    {
      label: 'Draft',
      count: statusCountsMap.get(OfferStatus.DRAFT) || 0,
      value: OfferStatus.DRAFT,
      isActive: statusFilter === OfferStatus.DRAFT,
      href: `/dashboard/hiring/offers?${new URLSearchParams({ ...baseParams, status: OfferStatus.DRAFT }).toString()}`,
    },
    {
      label: 'Pending Approval',
      count: statusCountsMap.get(OfferStatus.PENDING_APPROVAL) || 0,
      value: OfferStatus.PENDING_APPROVAL,
      isActive: statusFilter === OfferStatus.PENDING_APPROVAL,
      href: `/dashboard/hiring/offers?${new URLSearchParams({ ...baseParams, status: OfferStatus.PENDING_APPROVAL }).toString()}`,
    },
    {
      label: 'Approved',
      count: statusCountsMap.get(OfferStatus.APPROVED) || 0,
      value: OfferStatus.APPROVED,
      isActive: statusFilter === OfferStatus.APPROVED,
      href: `/dashboard/hiring/offers?${new URLSearchParams({ ...baseParams, status: OfferStatus.APPROVED }).toString()}`,
    },
    {
      label: 'Sent',
      count: statusCountsMap.get(OfferStatus.SENT) || 0,
      value: OfferStatus.SENT,
      isActive: statusFilter === OfferStatus.SENT,
      href: `/dashboard/hiring/offers?${new URLSearchParams({ ...baseParams, status: OfferStatus.SENT }).toString()}`,
    },
    {
      label: 'Accepted',
      count: statusCountsMap.get(OfferStatus.ACCEPTED) || 0,
      value: OfferStatus.ACCEPTED,
      isActive: statusFilter === OfferStatus.ACCEPTED,
      href: `/dashboard/hiring/offers?${new URLSearchParams({ ...baseParams, status: OfferStatus.ACCEPTED }).toString()}`,
    },
  ];

  // Map database offer items to Workspace candidate items
  const candidateItems: WorkspaceCandidateItem[] = offers.map((offer) => {
    const fullName = `${offer.application.applicant.firstName} ${offer.application.applicant.lastName}`;
    const initials = `${offer.application.applicant.firstName[0] || ''}${offer.application.applicant.lastName[0] || ''}`.toUpperCase();
    const formattedSalary = Number(offer.salary).toLocaleString('en-US');

    const checklist = [
      {
        id: 'drafted',
        title: 'Offer Package Drafted',
        subtitle: `Created by ${offer.createdBy.name}`,
        isComplete: true,
      },
      {
        id: 'approved',
        title: 'Compensation Approval',
        subtitle: offer.approvedBy
          ? `Approved by ${offer.approvedBy.name}`
          : 'Pending management approval',
        isComplete: Boolean(offer.approvedById),
      },
      {
        id: 'sent',
        title: 'Formal Offer Dispatched',
        subtitle:
          offer.status === OfferStatus.SENT ||
          offer.status === OfferStatus.ACCEPTED ||
          offer.status === OfferStatus.REJECTED
            ? 'Delivered to candidate'
            : 'Pending dispatch',
        isComplete:
          offer.status === OfferStatus.SENT ||
          offer.status === OfferStatus.ACCEPTED ||
          offer.status === OfferStatus.REJECTED,
      },
      {
        id: 'employee_sign',
        title: 'Candidate Acceptance Signature',
        subtitle: offer.contractSignedByEmployee
          ? 'Signed and confirmed by candidate'
          : 'Awaiting candidate acceptance',
        isComplete: offer.contractSignedByEmployee,
      },
      {
        id: 'president_sign',
        title: 'Institutional President Signature',
        subtitle: offer.contractSignedByPresident
          ? 'Counter-signed by President'
          : 'Awaiting institutional sign-off',
        isComplete: offer.contractSignedByPresident,
      },
    ];

    return {
      id: offer.id,
      applicationId: offer.application.id,
      name: fullName,
      position: offer.application.job.title,
      email: offer.application.applicant.email,
      phone: offer.application.applicant.phone,
      department: offer.application.job.department,
      appliedDate: new Date(offer.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      status: offer.status,
      statusLabel: formatStatusLabel(offer.status),
      avatarInitials: initials,
      workflowInfo: `PHP ${formattedSalary} / ${offer.payFrequency.toLowerCase()} • ${formatStatusLabel(offer.status)}`,
      workflowIcon: 'checklist',
      checklistTitle: 'Offer Approval & Execution Milestones',
      checklist,
      stageDetails: [
        { label: 'Offered Compensation', value: `PHP ${formattedSalary}` },
        { label: 'Pay Frequency', value: offer.payFrequency.replace(/_/g, ' ') },
        {
          label: 'Proposed Start Date',
          value: new Date(offer.startDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
        },
        { label: 'Compensation Drafted By', value: offer.createdBy.name },
        {
          label: 'Executive Approver',
          value: offer.approvedBy ? offer.approvedBy.name : 'Pending Approval',
        },
        {
          label: 'Candidate Agreement',
          value: offer.contractSignedByEmployee ? 'Signed' : 'Pending',
        },
        {
          label: 'President Agreement',
          value: offer.contractSignedByPresident ? 'Signed' : 'Pending',
        },
      ],
      workflowTabLabel: 'Offer',
    };
  });

  return (
    <div className="space-y-6">
      {/* Header with Breadcrumb and Title */}
      <HiringPageHeader
        breadcrumbs={[
          { label: 'Hiring', href: '/dashboard/hiring/pipeline' },
          { label: 'Offers' },
        ]}
        title={
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-700" />
            <span>Offer & Compensation Management Center</span>
          </div>
        }
        badge={
          <span className="flex h-5 items-center justify-center rounded-[6px] border-none bg-[#EEEDF1] px-2 text-[11px] font-semibold text-[#282934] tabular-nums">
            {totalCount} Total
          </span>
        }
        description="Track candidate employment packages, salary approvals, and signed agreements."
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
          ...Object.values(OfferStatus).map((st) => ({
            value: st,
            label: formatStatusLabel(st),
          })),
        ]}
        metricPills={metricPills}
        searchPlaceholder="Search candidate or job role..."
        baseUrl="/dashboard/hiring/offers"
      />

      {/* Responsive Card Grid with Candidate Detail Panel and Server Pagination */}
      <HiringCardWorkspace
        candidates={candidateItems}
        emptyMessage="No compensation offers found matching your filter criteria."
        pagination={
          <HiringPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalCount}
            pageSize={PAGE_SIZE}
            itemLabel="offers"
            baseUrl="/dashboard/hiring/offers"
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
