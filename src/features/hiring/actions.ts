'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/session';
import { canManageJobs, canUpdateApplicationStatus } from '@/lib/permissions/rbac';
import {
  JobStatus,
  EmploymentCategory,
  ApplicationStatus,
  RequirementType,
} from '@prisma/client';
import { getAvailableNextStatuses } from './pipeline';
import { transitionApplicationStatus, transitionInclude, transitionSource } from './status-transition';
import { getStageTransitionBlockers } from './stage-prerequisites';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function createJobAction(formData: FormData): Promise<void> {
  const user = await getSession();
  if (!user || !canManageJobs(user)) {
    redirect('/dashboard/hiring/jobs?error=unauthorized');
  }

  const title = (formData.get('title') as string)?.trim();
  const department = (formData.get('department') as string)?.trim();
  const employmentType = (formData.get('employmentType') as string)?.trim();
  const location = (formData.get('location') as string)?.trim();
  const description = (formData.get('description') as string)?.trim();
  const responsibilities = (formData.get('responsibilities') as string)?.trim();
  const qualifications = (formData.get('qualifications') as string)?.trim();
  const closingDateRaw = formData.get('closingDate') as string;
  const statusRaw = formData.get('status') as string;
  const reqsJson = formData.get('requirementsJson') as string;

  if (!title || !department || !employmentType || !location || !description) {
    redirect('/dashboard/hiring/jobs/new?error=missing_fields');
  }

  const baseSlug = slugify(title);
  let slug = baseSlug;
  let counter = 1;

  // Ensure unique slug within the organization
  while (
    await prisma.job.findUnique({
      where: {
        organizationId_slug: {
          organizationId: user.organizationId,
          slug,
        },
      },
    })
  ) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  let structuredReqsData: Array<{
    name: string;
    type: RequirementType;
    description?: string;
    isRequired: boolean;
  }> = [];

  if (reqsJson) {
    try {
      structuredReqsData = JSON.parse(reqsJson);
    } catch {
      // fallback
    }
  }

  const status = statusRaw === 'PUBLISHED' ? JobStatus.PUBLISHED : JobStatus.DRAFT;
  const publishedAt = status === JobStatus.PUBLISHED ? new Date() : null;
  const closingDate = closingDateRaw ? new Date(closingDateRaw) : null;

  const categoryRaw = (formData.get('category') as string)?.trim();
  const category =
    categoryRaw === 'TEACHING'
      ? EmploymentCategory.TEACHING
      : EmploymentCategory.NON_TEACHING;

  const job = await prisma.job.create({
    data: {
      organizationId: user.organizationId,
      title,
      slug,
      department,
      employmentType,
      location,
      category,
      description,
      responsibilities: responsibilities || description,
      qualifications: qualifications || description,
      requirements: structuredReqsData.map((r) => r.name).join(', ') || title,
      status,
      publishedAt,
      closingDate,
      structuredReqs: {
        create: structuredReqsData.map((r) => ({
          name: r.name,
          type: r.type || RequirementType.SKILL,
          description: r.description || '',
          isRequired: r.isRequired ?? true,
        })),
      },
    },
  });

  revalidatePath('/dashboard/hiring/jobs');
  redirect(`/dashboard/hiring/jobs/${job.id}`);
}

export async function updateJobAction(jobId: string, formData: FormData): Promise<void> {
  const user = await getSession();
  if (!user || !canManageJobs(user)) {
    redirect('/dashboard/hiring/jobs?error=unauthorized');
  }

  // Verify ownership
  const existingJob = await prisma.job.findFirst({
    where: { id: jobId, organizationId: user.organizationId },
  });

  if (!existingJob) {
    redirect('/dashboard/hiring/jobs?error=not_found');
  }

  const title = (formData.get('title') as string)?.trim();
  const department = (formData.get('department') as string)?.trim();
  const employmentType = (formData.get('employmentType') as string)?.trim();
  const location = (formData.get('location') as string)?.trim();
  const description = (formData.get('description') as string)?.trim();
  const responsibilities = (formData.get('responsibilities') as string)?.trim();
  const qualifications = (formData.get('qualifications') as string)?.trim();
  const closingDateRaw = formData.get('closingDate') as string;
  const reqsJson = formData.get('requirementsJson') as string;

  if (!title || !department || !employmentType || !location || !description) {
    redirect(`/dashboard/hiring/jobs/${jobId}/edit?error=missing_fields`);
  }

  let structuredReqsData: Array<{
    id?: string;
    name: string;
    type: RequirementType;
    description?: string;
    isRequired: boolean;
  }> = [];

  if (reqsJson) {
    try {
      structuredReqsData = JSON.parse(reqsJson);
    } catch {
      // fallback
    }
  }

  // Re-create structured requirements cleanly
  await prisma.jobRequirement.deleteMany({ where: { jobId } });

  const categoryRaw = (formData.get('category') as string)?.trim();

  await prisma.job.update({
    where: { id: jobId },
    data: {
      title,
      department,
      employmentType,
      location,
      ...(categoryRaw
        ? {
            category:
              categoryRaw === 'TEACHING'
                ? EmploymentCategory.TEACHING
                : EmploymentCategory.NON_TEACHING,
          }
        : {}),
      description,
      responsibilities: responsibilities || description,
      qualifications: qualifications || description,
      requirements: structuredReqsData.map((r) => r.name).join(', ') || title,
      closingDate: closingDateRaw ? new Date(closingDateRaw) : null,
      structuredReqs: {
        create: structuredReqsData.map((r) => ({
          name: r.name,
          type: r.type || RequirementType.SKILL,
          description: r.description || '',
          isRequired: r.isRequired ?? true,
        })),
      },
    },
  });

  revalidatePath('/dashboard/hiring/jobs');
  revalidatePath(`/dashboard/hiring/jobs/${jobId}`);
  redirect(`/dashboard/hiring/jobs/${jobId}`);
}

export async function publishJobAction(jobId: string) {
  const user = await getSession();
  if (!user || !canManageJobs(user)) {
    return { error: 'Unauthorized to publish jobs.' };
  }

  const existingJob = await prisma.job.findFirst({
    where: { id: jobId, organizationId: user.organizationId },
  });

  if (!existingJob) {
    return { error: 'Job posting not found.' };
  }

  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: JobStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  });

  revalidatePath('/dashboard/hiring/jobs');
  revalidatePath(`/dashboard/hiring/jobs/${jobId}`);
  revalidatePath('/careers');
  return { success: true };
}

export async function closeJobAction(jobId: string) {
  const user = await getSession();
  if (!user || !canManageJobs(user)) {
    return { error: 'Unauthorized to close jobs.' };
  }

  const existingJob = await prisma.job.findFirst({
    where: { id: jobId, organizationId: user.organizationId },
  });

  if (!existingJob) {
    return { error: 'Job posting not found.' };
  }

  await prisma.job.update({
    where: { id: jobId },
    data: {
      status: JobStatus.CLOSED,
    },
  });

  revalidatePath('/dashboard/hiring/jobs');
  revalidatePath(`/dashboard/hiring/jobs/${jobId}`);
  revalidatePath('/careers');
  return { success: true };
}

export async function updateApplicationStatusAction(
  applicationId: string,
  newStatus: ApplicationStatus
) {
  const user = await getSession();
  if (!user || !canUpdateApplicationStatus(user)) {
    return { error: 'Unauthorized to update application status.' };
  }

  const result = await transitionApplicationStatus({ applicationId, target: newStatus, organizationId: user.organizationId, actorUserId: user.userId });
  if (result.error) return result;

  revalidatePath('/dashboard/hiring/pipeline');
  revalidatePath('/dashboard/hiring/applicants');
  revalidatePath('/dashboard/hiring/onboarding');
  revalidatePath(`/dashboard/hiring/applicants/${applicationId}`);
  return { success: true };
}

/** Read-only, tenant-scoped restrictions for both the board and profile controller. */
export async function getApplicationTransitionOptionsAction(applicationId: string) {
  const user = await getSession();
  if (!user || !canUpdateApplicationStatus(user)) return { error: 'Unauthorized to view stage restrictions.' };
  const application = await prisma.application.findFirst({
    where: { id: applicationId, job: { organizationId: user.organizationId } },
    include: transitionInclude,
  });
  if (!application) return { error: 'Application not found or access denied.' };
  const source = transitionSource(application);
  return { status: application.status, options: getAvailableNextStatuses(application.status)
    .filter(status => status !== ApplicationStatus.HIRED)
    .map(status => ({ status, blockers: getStageTransitionBlockers(source, status) })) };
}
