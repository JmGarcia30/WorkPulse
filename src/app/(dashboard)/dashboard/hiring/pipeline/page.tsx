import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import { canViewHiringData, canUpdateApplicationStatus } from '@/lib/permissions/rbac';
import { ApplicationPipeline } from '@/components/hiring/ApplicationPipeline';
import { ErrorState } from '@/components/ui/ErrorState';
import Link from 'next/link';
import { ListFilter } from 'lucide-react';
import { HiringPageHeader } from '@/components/hiring/HiringPageHeader';

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
  const jobsPromise = prisma.job.findMany({
    where: { organizationId: user.organizationId },
    select: { id: true, title: true, department: true },
    orderBy: { title: 'asc' },
  });

  // The unfiltered pipeline doesn't depend on the job selector. Only filtered
  // requests wait for ownership validation, preserving invalid-ID behavior.
  const selectedJobPromise = rawJobId
    ? jobsPromise.then(jobs => jobs.some(job => job.id === rawJobId) ? rawJobId : undefined)
    : Promise.resolve(undefined);
  const applicationsPromise = selectedJobPromise.then(validJobId => prisma.application.findMany({
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
  }));
  const [organizationJobs, validJobId, applications] = await Promise.all([
    jobsPromise, selectedJobPromise, applicationsPromise,
  ]);

  const canEditStatus = canUpdateApplicationStatus(user);

  // Serialize dates for Client Component safety
  const serializedApplications = applications.map((app) => ({
    ...app,
    appliedAt: app.appliedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      {/* Page Header with Breadcrumb and Title */}
      <HiringPageHeader
        breadcrumbs={[
          { label: 'Hiring', href: '/dashboard/hiring/pipeline' },
          { label: 'Pipeline' },
        ]}
        title="Hiring Pipeline"
        badge={
          <span className="flex h-5 items-center justify-center rounded-[6px] border-none bg-[#EEEDF1] px-2 text-[11px] font-semibold text-[#282934] tabular-nums">
            {serializedApplications.length} Candidates
          </span>
        }
        description="Review candidates by stage, filter by position, and take the next hiring action."
        actions={
          <Link
            href="/dashboard/hiring/applicants"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs"
          >
            <ListFilter className="h-3.5 w-3.5 text-slate-400" />
            <span>Table View</span>
          </Link>
        }
      />

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
