'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/session';
import { canManageAssessments, canRecordAssessmentResult } from '@/lib/permissions/rbac';
import { AssessmentStatus, AssessmentType } from '@prisma/client';
import { isValidAssessmentTransition } from './assessment-pipeline';

export interface CreateAssessmentInput {
  applicationId: string;
  title: string;
  type?: AssessmentType;
  description?: string;
  dueDate?: string; // ISO date string
  passingScore?: number;
  maxScore?: number;
  evaluatorId?: string;
}

export interface SubmitAssessmentResultInput {
  score: number;
  maxScore?: number;
  passingScore?: number;
  reviewerNotes?: string;
}

/**
 * Fetch active users for assessment evaluator selection, strictly scoped to caller's organization.
 */
export async function getOrganizationEvaluators() {
  const user = await getSession();
  if (!user || !canManageAssessments(user)) {
    return [];
  }

  return prisma.user.findMany({
    where: { organizationId: user.organizationId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: { name: 'asc' },
  });
}

/**
 * Assign a new pre-employment assessment to a candidate application.
 */
export async function createAssessmentAction(input: CreateAssessmentInput) {
  const user = await getSession();
  if (!user || !canManageAssessments(user)) {
    return { error: 'Unauthorized to create or assign assessments.' };
  }

  const {
    applicationId,
    title,
    type = AssessmentType.TECHNICAL,
    description,
    dueDate,
    passingScore,
    maxScore,
    evaluatorId,
  } = input;

  if (!applicationId || !title || !title.trim()) {
    return { error: 'Application and assessment title are required.' };
  }

  // Validate scores if provided
  const max = maxScore !== undefined ? Number(maxScore) : 100;
  if (isNaN(max) || max <= 0) {
    return { error: 'Maximum score must be greater than 0.' };
  }

  const pass = passingScore !== undefined ? Number(passingScore) : 75;
  if (isNaN(pass) || pass < 0 || pass > max) {
    return { error: `Passing score must be between 0 and maximum score (${max}).` };
  }

  let dueDateTime: Date | null = null;
  if (dueDate) {
    dueDateTime = new Date(dueDate);
    if (isNaN(dueDateTime.getTime())) {
      return { error: 'Invalid due date provided.' };
    }
  }

  // Derived Multi-tenant Check: Verify Application belongs to User's Organization
  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      job: {
        organizationId: user.organizationId,
      },
    },
    include: {
      job: true,
    },
  });

  if (!application) {
    return { error: 'Application not found or access denied.' };
  }

  // If evaluator is assigned, verify evaluator belongs to same organization
  if (evaluatorId) {
    const evaluator = await prisma.user.findFirst({
      where: {
        id: evaluatorId,
        organizationId: user.organizationId,
      },
    });

    if (!evaluator) {
      return { error: 'Selected evaluator does not belong to your organization.' };
    }
  }

  const assessment = await prisma.assessment.create({
    data: {
      applicationId,
      title: title.trim(),
      type,
      description: description?.trim() || null,
      dueDate: dueDateTime,
      maxScore: max,
      passingScore: pass,
      evaluatorId: evaluatorId || null,
      status: AssessmentStatus.ASSIGNED,
    },
  });

  revalidatePath('/dashboard/hiring/assessments');
  revalidatePath('/dashboard/hiring/applicants');
  revalidatePath(`/dashboard/hiring/applicants/${applicationId}`);
  revalidatePath('/dashboard');

  return { success: true, assessmentId: assessment.id };
}

/**
 * Record assessment result and score with automatic pass/fail evaluation.
 */
export async function submitAssessmentResultAction(
  assessmentId: string,
  input: SubmitAssessmentResultInput
) {
  const user = await getSession();
  if (!user || !canRecordAssessmentResult(user)) {
    return { error: 'Unauthorized to record assessment results.' };
  }

  if (!assessmentId) {
    return { error: 'Assessment ID is required.' };
  }

  // Derive tenant: Assessment -> Application -> Job -> Organization
  const assessment = await prisma.assessment.findFirst({
    where: {
      id: assessmentId,
      application: {
        job: {
          organizationId: user.organizationId,
        },
      },
    },
    include: {
      application: true,
    },
  });

  if (!assessment) {
    return { error: 'Assessment not found or access denied.' };
  }

  // Enforce score boundaries
  const score = Number(input.score);
  if (isNaN(score) || score < 0) {
    return { error: 'Score cannot be negative or invalid.' };
  }

  const maxScore =
    input.maxScore !== undefined
      ? Number(input.maxScore)
      : assessment.maxScore ?? 100;

  if (isNaN(maxScore) || maxScore <= 0) {
    return { error: 'Maximum score must be greater than 0.' };
  }

  if (score > maxScore) {
    return { error: `Score (${score}) cannot exceed maximum score (${maxScore}).` };
  }

  const passingScore =
    input.passingScore !== undefined
      ? Number(input.passingScore)
      : assessment.passingScore ?? 75;

  if (isNaN(passingScore) || passingScore < 0 || passingScore > maxScore) {
    return { error: `Passing score must be between 0 and maximum score (${maxScore}).` };
  }

  // Determine automatic status
  const targetStatus =
    score >= passingScore ? AssessmentStatus.PASSED : AssessmentStatus.FAILED;

  // Validate state transition
  // If assessment is already in a terminal status, reject modification
  if (
    assessment.status === AssessmentStatus.PASSED ||
    assessment.status === AssessmentStatus.FAILED ||
    assessment.status === AssessmentStatus.EXPIRED ||
    assessment.status === AssessmentStatus.CANCELLED
  ) {
    return {
      error: `Cannot submit results for assessment in terminal state ${assessment.status}.`,
    };
  }

  const updatedAssessment = await prisma.assessment.update({
    where: { id: assessmentId },
    data: {
      score,
      maxScore,
      passingScore,
      status: targetStatus,
      submittedAt: assessment.submittedAt || new Date(),
      evaluatedAt: new Date(),
      evaluatorId: user.userId,
      reviewerNotes: input.reviewerNotes?.trim() || null,
    },
  });

  revalidatePath('/dashboard/hiring/assessments');
  revalidatePath(`/dashboard/hiring/applicants/${assessment.applicationId}`);
  revalidatePath('/dashboard');

  return { success: true, status: updatedAssessment.status, score: updatedAssessment.score };
}

/**
 * Update assessment status using centralized transition validation.
 */
export async function updateAssessmentStatusAction(
  assessmentId: string,
  newStatus: AssessmentStatus
) {
  const user = await getSession();
  if (!user || !canManageAssessments(user)) {
    return { error: 'Unauthorized to change assessment status.' };
  }

  if (!Object.values(AssessmentStatus).includes(newStatus)) {
    return { error: 'Invalid assessment status provided.' };
  }

  // Derive tenant: Assessment -> Application -> Job -> Organization
  const assessment = await prisma.assessment.findFirst({
    where: {
      id: assessmentId,
      application: {
        job: {
          organizationId: user.organizationId,
        },
      },
    },
  });

  if (!assessment) {
    return { error: 'Assessment not found or access denied.' };
  }

  if (!isValidAssessmentTransition(assessment.status, newStatus)) {
    return {
      error: `Invalid assessment transition from ${assessment.status} to ${newStatus}.`,
    };
  }

  await prisma.assessment.update({
    where: { id: assessmentId },
    data: {
      status: newStatus,
      ...(newStatus === AssessmentStatus.SUBMITTED && !assessment.submittedAt
        ? { submittedAt: new Date() }
        : {}),
    },
  });

  revalidatePath('/dashboard/hiring/assessments');
  revalidatePath(`/dashboard/hiring/applicants/${assessment.applicationId}`);
  revalidatePath('/dashboard');

  return { success: true };
}
