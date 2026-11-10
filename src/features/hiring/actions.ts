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
import { z } from 'zod';
import { auditedJobMutation } from '@/features/account-security/job-audit';
import { ActiveJobLimitError } from '@/features/subscriptions/job-limit';
import { archiveClosedJob, reuseArchivedJob, JobLifecycleError } from './job-archive-reuse';
import { enforceJobMutationBudget, JobRateLimitError } from './job-rate-budget';
import { validateJobClosingDate, isJobDeadlinePassed } from './job-deadline';

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
  const org = await prisma.organization.findUnique({ where: { id: user.organizationId }, select: { timeZone: true } });
  if (!org) redirect('/dashboard/hiring/jobs?error=unauthorized');
  let closingDate: Date | null;
  try { closingDate = validateJobClosingDate(closingDateRaw, org.timeZone); }
  catch { redirect('/dashboard/hiring/jobs/new?error=invalid_deadline'); }

  const categoryRaw = (formData.get('category') as string)?.trim();
  const category =
    categoryRaw === 'TEACHING'
      ? EmploymentCategory.TEACHING
      : EmploymentCategory.NON_TEACHING;

  const job = await auditedJobMutation(prisma, user, 'JOB_CREATED', tx => tx.job.create({
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
  })).catch(error=>{
    if(error instanceof ActiveJobLimitError)redirect('/dashboard/hiring/jobs/new?error=active_job_limit');
    throw error;
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
  if (existingJob.status === JobStatus.ARCHIVED) {
    redirect(`/dashboard/hiring/jobs/${jobId}?error=Archived%20postings%20are%20read-only.%20Choose%20Reuse%20Posting%20to%20start%20a%20new%20cycle.`);
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

  const org = await prisma.organization.findUnique({ where: { id: user.organizationId }, select: { timeZone: true } });
  if (!org) redirect('/dashboard/hiring/jobs?error=unauthorized');
  let closingDate: Date | null;
  try { closingDate = validateJobClosingDate(closingDateRaw, org.timeZone); }
  catch { redirect(`/dashboard/hiring/jobs/${jobId}/edit?error=invalid_deadline`); }

  let rawRequirements: unknown = [];
  try {
    if (reqsJson) rawRequirements = JSON.parse(reqsJson);
  } catch {
    redirect(`/dashboard/hiring/jobs/${jobId}/edit?error=invalid_fields`);
  }
  const parsedRequirements = z.array(z.object({
    name: z.string(),
    type: z.enum(RequirementType).or(z.literal('')).nullish().transform(value => value || RequirementType.SKILL),
    description: z.string().nullish().transform(value => value || ''),
    isRequired: z.boolean().nullish().transform(value => value ?? true),
  })).safeParse(rawRequirements);
  if (!parsedRequirements.success) {
    redirect(`/dashboard/hiring/jobs/${jobId}/edit?error=invalid_fields`);
  }
  const structuredReqsData = parsedRequirements.data;

  const categoryRaw = (formData.get('category') as string)?.trim();

  await auditedJobMutation(prisma, user, 'JOB_UPDATED', tx => tx.job.update({
    where: { id: jobId, organizationId: user.organizationId, status: { not: JobStatus.ARCHIVED } },
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
      closingDate,
      structuredReqs: {
        // A nested write atomically replaces requirements with the job update.
        deleteMany: {},
        create: structuredReqsData.map((r) => ({
          name: r.name,
          type: r.type || RequirementType.SKILL,
          description: r.description || '',
          isRequired: r.isRequired ?? true,
        })),
      },
    },
  }));

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

  // Archived postings are immutable historical cycles; reuse creates a NEW draft.
  if (existingJob.status === JobStatus.ARCHIVED) {
    return { error: 'Archived postings cannot be published again. Choose Reuse Posting to make a new draft.' };
  }
  if (existingJob.status === JobStatus.PUBLISHED) {
    return { error: 'This job is already published.' };
  }
  const org = await prisma.organization.findUnique({ where: { id: user.organizationId }, select: { timeZone: true } });
  if (!org || isJobDeadlinePassed(existingJob.closingDate, org.timeZone)) {
    return { error: 'The closing date has passed. Edit the deadline before publishing.' };
  }
  try { await auditedJobMutation(prisma, user, 'JOB_PUBLISHED', tx => tx.job.update({
    where: { id: jobId, organizationId: user.organizationId, status: { in: [JobStatus.DRAFT, JobStatus.CLOSED] } },
    data: {
      status: JobStatus.PUBLISHED,
      publishedAt: new Date(),
    },
  })); } catch(error) {
    if(error instanceof ActiveJobLimitError)return {error:error.message};
    return {error:'Posting status may have changed. Refresh and try again.'};
  }

  revalidatePath('/dashboard/hiring/jobs');
  revalidatePath(`/dashboard/hiring/jobs/${jobId}`);
  revalidatePath('/careers');
  return { success: true };
}

export async function closeJobAction(jobId: string): Promise<{success?: boolean; error?: string}> {
  const user = await getSession();
  if (!user || !canManageJobs(user)) return { error: 'You are not authorized to close this posting.' };

  try {
    await enforceJobMutationBudget(prisma, user);
    await auditedJobMutation(prisma, user, 'JOB_CLOSED', async tx => {
      const changed = await tx.job.updateMany({
        where: { id: jobId, organizationId: user.organizationId, status: JobStatus.PUBLISHED },
        data: { status: JobStatus.CLOSED },
      });
      if (changed.count !== 1) {
        throw new JobLifecycleError('Only a published posting can be closed. Refresh the page if its status changed.');
      }
      return tx.job.findFirstOrThrow({ where: { id: jobId, organizationId: user.organizationId }, select: { id: true } });
    });
  } catch (error) {
    return { error: error instanceof JobRateLimitError ? error.message : error instanceof JobLifecycleError ? error.message : 'Unable to close posting. Try again or contact your administrator.' };
  }
  revalidatePath('/dashboard/hiring/jobs');
  revalidatePath(`/dashboard/hiring/jobs/${jobId}`);
  revalidatePath('/careers');
  return { success: true };
}

export async function archiveJobAction(jobId: string): Promise<{success?: boolean; error?: string}> {
  const user = await getSession();
  if (!user || !canManageJobs(user)) return { error: 'You are not authorized to archive this posting.' };
  try {
    await enforceJobMutationBudget(prisma, user);
    await archiveClosedJob(prisma, user, jobId);
  } catch (error) {
    return { error: error instanceof JobRateLimitError ? error.message : error instanceof JobLifecycleError ? error.message : 'Unable to archive posting. Try again or contact your administrator.' };
  }
  revalidatePath('/dashboard/hiring/jobs');
  revalidatePath(`/dashboard/hiring/jobs/${jobId}`);
  revalidatePath('/careers');
  return { success: true };
}

export async function reuseJobAction(jobId: string, requestId: string): Promise<{jobId?: string; error?: string}> {
  const user = await getSession();
  if (!user || !canManageJobs(user)) return { error: 'You are not authorized to reuse this posting.' };
  try {
    await enforceJobMutationBudget(prisma, user);
    const copy = await reuseArchivedJob(prisma, user, jobId, requestId);
    revalidatePath('/dashboard/hiring/jobs');
    revalidatePath(`/dashboard/hiring/jobs/${jobId}`);
    return { jobId: copy.id };
  } catch (error) {
    return { error: error instanceof JobRateLimitError ? error.message : error instanceof JobLifecycleError ? error.message : 'Unable to create a new draft from this posting. Please try again.' };
  }
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
  if (application.archivedAt) return { error: 'Archived applications are read-only. Restore the application first.' };
  const source = transitionSource(application);
  return { status: application.status, options: getAvailableNextStatuses(application.status)
    .filter(status => status !== ApplicationStatus.HIRED)
    .map(status => ({ status, blockers: getStageTransitionBlockers(source, status) })) };
}
