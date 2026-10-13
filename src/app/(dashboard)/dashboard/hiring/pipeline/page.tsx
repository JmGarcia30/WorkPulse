import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { canViewHiringData, canUpdateApplicationStatus } from '@/lib/permissions/rbac';
import { ApplicationPipeline } from '@/components/hiring/ApplicationPipeline';
import { ErrorState } from '@/components/ui/ErrorState';
import Link from 'next/link';
import { Users, ListFilter } from 'lucide-react';

interface PipelinePageProps {
  searchParams: Promise<{
    jobId?: string;
  }>;
}

export default async function PipelinePage({ searchParams }: PipelinePageProps) {
  const user = await getSession();
  if (!user) return null;

  if (!canViewHiringData(user)) {
    return (
      <ErrorState
        title="Access Denied"
        message="You do not have permission to view the hiring pipeline."
      />
    );
  }

  const params = await searchParams;
  const rawJobId = params.jobId?.trim();

  // 1. Fetch organization jobs (Server-side multi-tenant filtering)
  const organizationJobs = await prisma.job.findMany({
    where: { organizationId: user.organizationId },
    select: { id: true, title: true, department: true },
    orderBy: { title: 'asc' },
  });

  // 2. Validate selected jobId belongs to authenticated user's organization
  let validJobId: string | undefined = undefined;
  if (rawJobId) {
    const jobExistsInOrg = organizationJobs.some((j) => j.id === rawJobId);
    if (jobExistsInOrg) {
      validJobId = rawJobId;
    }
  }

  // 3. Fetch applications strictly belonging to user's organization
  const applications = await prisma.application.findMany({
    where: {
      job: {
        organizationId: user.organizationId,
        id: validJobId,
      },
    },
    orderBy: { appliedAt: 'desc' },
    select: {
      id: true,
      status: true,
      appliedAt: true,
      applicant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      job: {
        select: {
          id: true,
          title: true,
          department: true,
        },
      },
    },
  });

  const canEditStatus = canUpdateApplicationStatus(user);

  // Serialize dates for Client Component safety
  const serializedApplications = applications.map((app) => ({
    ...app,
    appliedAt: app.appliedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--wp-border)] pb-5">
        <div>
          <h1 className="wp-page-title text-xl font-semibold text-[var(--wp-text)] flex items-center gap-2">
            <Users className="h-5 w-5 text-[var(--wp-text)]" />
            Hiring pipeline
          </h1>
          <p className="text-sm text-[var(--wp-text-muted)] mt-0.5">
            Review candidates by stage and open a profile to take the next hiring action.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/hiring/applicants"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--wp-border)] bg-white px-4 py-2 text-sm font-bold text-[var(--wp-text)] hover:bg-[#F8F9FA] transition"
          >
            <ListFilter className="h-3.5 w-3.5" /> Table View
          </Link>
        </div>
      </div>

      {/* Kanban Pipeline Component */}
      <ApplicationPipeline
        jobs={organizationJobs}
        applications={serializedApplications}
        selectedJobId={validJobId}
        canEditStatus={canEditStatus}
      />
    </div>
  );
}
