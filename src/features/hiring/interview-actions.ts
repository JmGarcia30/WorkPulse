'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/session';
import { canManageInterviews, canEvaluateCandidate } from '@/lib/permissions/rbac';
import {
  InterviewType,
  InterviewStatus,
  EvaluationRecommendation,
  AssessmentType,
  AssessmentStatus,
} from '@prisma/client';

export interface CreateInterviewInput {
  applicationId: string;
  interviewerId: string;
  scheduledAt: string; // ISO date string
  durationMinutes?: number;
  type?: InterviewType;
  location?: string;
  meetingUrl?: string;
  notes?: string;
}

export interface UpdateInterviewInput {
  scheduledAt?: string;
  durationMinutes?: number;
  type?: InterviewType;
  location?: string;
  meetingUrl?: string;
  notes?: string;
}

export interface CreateEvaluationInput {
  interviewId: string;
  communicationScore: number;
  technicalScore: number;
  problemSolvingScore: number;
  experienceScore: number;
  cultureFitScore: number;
  recommendation: EvaluationRecommendation;
  comments: string;
}

export interface UpdateEvaluationInput {
  communicationScore?: number;
  technicalScore?: number;
  problemSolvingScore?: number;
  experienceScore?: number;
  cultureFitScore?: number;
  recommendation?: EvaluationRecommendation;
  comments?: string;
}

/**
 * Fetch active users for interviewer selection, strictly scoped to the caller's organization.
 */
export async function getOrganizationInterviewers() {
  const user = await getSession();
  if (!user || !canManageInterviews(user)) {
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
 * Schedule a new interview for a candidate application.
 */
export async function createInterviewAction(input: CreateInterviewInput) {
  const user = await getSession();
  if (!user || !canManageInterviews(user)) {
    return { error: 'Unauthorized to schedule interviews.' };
  }

  const {
    applicationId,
    interviewerId,
    scheduledAt,
    durationMinutes = 45,
    type = InterviewType.INITIAL_SCREENING,
    location,
    meetingUrl,
    notes,
  } = input;

  if (!applicationId || !interviewerId || !scheduledAt) {
    return { error: 'Application, interviewer, and scheduled date/time are required.' };
  }

  const scheduledDate = new Date(scheduledAt);
  if (isNaN(scheduledDate.getTime())) {
    return { error: 'Invalid scheduled date/time provided.' };
  }

  const duration = Number(durationMinutes);
  if (isNaN(duration) || duration < 5 || duration > 480) {
    return { error: 'Duration must be between 5 and 480 minutes.' };
  }

  if (meetingUrl && meetingUrl.trim()) {
    try {
      const parsedUrl = new URL(meetingUrl.trim());
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return { error: 'Meeting URL must be a valid HTTP/HTTPS URL.' };
      }
    } catch {
      return { error: 'Meeting URL is not a valid web URL.' };
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
      interviews: {
        include: { evaluation: true },
      },
      assessments: true,
    },
  });

  if (!application) {
    return { error: 'Application not found or access denied.' };
  }

  // SAGA Institutional Gating Validation
  if (type === InterviewType.TEACHING_DEMONSTRATION) {
    if (application.job.category === 'NON_TEACHING') {
      return {
        error: 'Teaching Demonstration applies only to Teaching (Faculty) positions.',
      };
    }
    // Written exam check if exists
    const exam = application.assessments.find(
      (a) =>
        a.type === AssessmentType.WRITTEN_EXAMINATION ||
        a.title.toLowerCase().includes('written') ||
        a.title.toLowerCase().includes('exam')
    );
    if (exam && exam.status === AssessmentStatus.FAILED) {
      return {
        error: 'Candidate cannot undergo a Teaching Demonstration after failing the written examination.',
      };
    }
  }

  if (type === InterviewType.HEAD_OF_DEPARTMENT && application.job.category === 'TEACHING') {
    const demo = application.interviews.find(
      (i) => i.type === InterviewType.TEACHING_DEMONSTRATION
    );
    if (
      demo &&
      (demo.status !== InterviewStatus.COMPLETED ||
        demo.evaluation?.recommendation === EvaluationRecommendation.DO_NOT_RECOMMEND)
    ) {
      return {
        error: 'Teaching applicants must receive a satisfactory Teaching Demonstration result before progressing to the Head of Department Interview.',
      };
    }
  }

  if (type === InterviewType.PRESIDENT_FINAL) {
    const hod = application.interviews.find(
      (i) => i.type === InterviewType.HEAD_OF_DEPARTMENT
    );
    if (
      hod &&
      (hod.status !== InterviewStatus.COMPLETED ||
        hod.evaluation?.recommendation === EvaluationRecommendation.DO_NOT_RECOMMEND)
    ) {
      return {
        error: 'Applicant must successfully complete the Head of Department Interview and be endorsed before scheduling the President Final Interview.',
      };
    }
  }

  // Multi-tenant check: Verify Interviewer belongs to the exact same Organization
  const interviewer = await prisma.user.findFirst({
    where: {
      id: interviewerId,
      organizationId: user.organizationId,
    },
  });

  if (!interviewer) {
    return { error: 'Selected interviewer does not belong to your organization.' };
  }

  // Create Interview
  const interview = await prisma.interview.create({
    data: {
      applicationId,
      interviewerId,
      scheduledAt: scheduledDate,
      durationMinutes: duration,
      type,
      location: location?.trim() || null,
      meetingUrl: meetingUrl?.trim() || null,
      notes: notes?.trim() || null,
      status: InterviewStatus.SCHEDULED,
    },
  });

  revalidatePath('/dashboard/hiring/interviews');
  revalidatePath('/dashboard/hiring/applicants');
  revalidatePath(`/dashboard/hiring/applicants/${applicationId}`);
  revalidatePath('/dashboard');

  return { success: true, interviewId: interview.id };
}

/**
 * Update interview details (reschedule, change notes, etc.)
 */
export async function updateInterviewAction(
  interviewId: string,
  input: UpdateInterviewInput
) {
  const user = await getSession();
  if (!user || !canManageInterviews(user)) {
    return { error: 'Unauthorized to update interview.' };
  }

  // Derive tenant: Interview -> Application -> Job -> Organization
  const interview = await prisma.interview.findFirst({
    where: {
      id: interviewId,
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

  if (!interview) {
    return { error: 'Interview not found or access denied.' };
  }

  const updateData: {
    scheduledAt?: Date;
    durationMinutes?: number;
    type?: InterviewType;
    location?: string | null;
    meetingUrl?: string | null;
    notes?: string | null;
  } = {};

  if (input.scheduledAt) {
    const scheduledDate = new Date(input.scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return { error: 'Invalid scheduled date/time.' };
    }
    updateData.scheduledAt = scheduledDate;
  }

  if (input.durationMinutes !== undefined) {
    const duration = Number(input.durationMinutes);
    if (isNaN(duration) || duration < 5 || duration > 480) {
      return { error: 'Duration must be between 5 and 480 minutes.' };
    }
    updateData.durationMinutes = duration;
  }

  if (input.type) {
    updateData.type = input.type;
  }

  if (input.location !== undefined) {
    updateData.location = input.location.trim() || null;
  }

  if (input.meetingUrl !== undefined) {
    if (input.meetingUrl.trim()) {
      try {
        const parsedUrl = new URL(input.meetingUrl.trim());
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          return { error: 'Meeting URL must be a valid HTTP/HTTPS URL.' };
        }
      } catch {
        return { error: 'Meeting URL is not a valid web URL.' };
      }
      updateData.meetingUrl = input.meetingUrl.trim();
    } else {
      updateData.meetingUrl = null;
    }
  }

  if (input.notes !== undefined) {
    updateData.notes = input.notes.trim() || null;
  }

  await prisma.interview.update({
    where: { id: interviewId },
    data: updateData,
  });

  revalidatePath('/dashboard/hiring/interviews');
  revalidatePath(`/dashboard/hiring/applicants/${interview.applicationId}`);
  revalidatePath('/dashboard');

  return { success: true };
}

/**
 * Update interview status (e.g. COMPLETED, CANCELLED, NO_SHOW, SCHEDULED).
 */
export async function updateInterviewStatusAction(
  interviewId: string,
  newStatus: InterviewStatus
) {
  const user = await getSession();
  if (!user || !canManageInterviews(user)) {
    return { error: 'Unauthorized to change interview status.' };
  }

  if (!Object.values(InterviewStatus).includes(newStatus)) {
    return { error: 'Invalid interview status provided.' };
  }

  // Derive tenant: Interview -> Application -> Job -> Organization
  const interview = await prisma.interview.findFirst({
    where: {
      id: interviewId,
      application: {
        job: {
          organizationId: user.organizationId,
        },
      },
    },
  });

  if (!interview) {
    return { error: 'Interview not found or access denied.' };
  }

  await prisma.interview.update({
    where: { id: interviewId },
    data: { status: newStatus },
  });

  revalidatePath('/dashboard/hiring/interviews');
  revalidatePath(`/dashboard/hiring/applicants/${interview.applicationId}`);
  revalidatePath('/dashboard');

  return { success: true };
}

/**
 * Submit candidate evaluation for an interview.
 * Explicit workflow: Interview must be in user's tenant, and completion status is set to COMPLETED.
 */
export async function createEvaluationAction(input: CreateEvaluationInput) {
  const user = await getSession();
  if (!user || !canEvaluateCandidate(user)) {
    return { error: 'Unauthorized to evaluate candidates.' };
  }

  const {
    interviewId,
    communicationScore,
    technicalScore,
    problemSolvingScore,
    experienceScore,
    cultureFitScore,
    recommendation,
    comments,
  } = input;

  if (!interviewId) {
    return { error: 'Interview ID is required.' };
  }

  // Validate scores (must be integers 1 to 5)
  const scores = [
    communicationScore,
    technicalScore,
    problemSolvingScore,
    experienceScore,
    cultureFitScore,
  ];

  for (const s of scores) {
    if (typeof s !== 'number' || !Number.isInteger(s) || s < 1 || s > 5) {
      return { error: 'All competency scores must be integers between 1 and 5.' };
    }
  }

  if (!Object.values(EvaluationRecommendation).includes(recommendation)) {
    return { error: 'Invalid evaluation recommendation.' };
  }

  if (!comments || comments.trim().length < 5) {
    return { error: 'Please provide meaningful evaluation comments (at least 5 characters).' };
  }

  // Derive tenant: Interview -> Application -> Job -> Organization
  const interview = await prisma.interview.findFirst({
    where: {
      id: interviewId,
      application: {
        job: {
          organizationId: user.organizationId,
        },
      },
    },
    include: {
      evaluation: true,
      application: true,
    },
  });

  if (!interview) {
    return { error: 'Interview not found or access denied.' };
  }

  if (interview.status === InterviewStatus.CANCELLED) {
    return { error: 'Cannot submit evaluation for a cancelled interview.' };
  }

  // Prevent duplicate evaluations
  if (interview.evaluation) {
    return { error: 'An evaluation has already been submitted for this interview.' };
  }

  // Calculate overall score (average of the 5 criteria, rounded to 1 decimal place)
  const rawAverage =
    (communicationScore +
      technicalScore +
      problemSolvingScore +
      experienceScore +
      cultureFitScore) /
    5;
  const overallScore = Math.round(rawAverage * 10) / 10;

  // Transaction: Create evaluation and ensure interview status is marked COMPLETED
  await prisma.$transaction([
    prisma.candidateEvaluation.create({
      data: {
        interviewId,
        communicationScore,
        technicalScore,
        problemSolvingScore,
        experienceScore,
        cultureFitScore,
        overallScore,
        recommendation,
        comments: comments.trim(),
        evaluatedById: user.userId,
      },
    }),
    prisma.interview.update({
      where: { id: interviewId },
      data: { status: InterviewStatus.COMPLETED },
    }),
  ]);

  revalidatePath('/dashboard/hiring/interviews');
  revalidatePath(`/dashboard/hiring/applicants/${interview.applicationId}`);
  revalidatePath('/dashboard');

  return { success: true };
}

/**
 * Update an existing evaluation.
 */
export async function updateEvaluationAction(
  evaluationId: string,
  input: UpdateEvaluationInput
) {
  const user = await getSession();
  if (!user || !canEvaluateCandidate(user)) {
    return { error: 'Unauthorized to update evaluation.' };
  }

  // Derive tenant: Evaluation -> Interview -> Application -> Job -> Organization
  const evaluation = await prisma.candidateEvaluation.findFirst({
    where: {
      id: evaluationId,
      interview: {
        application: {
          job: {
            organizationId: user.organizationId,
          },
        },
      },
    },
    include: {
      interview: true,
    },
  });

  if (!evaluation) {
    return { error: 'Evaluation not found or access denied.' };
  }

  const comm = input.communicationScore ?? evaluation.communicationScore;
  const tech = input.technicalScore ?? evaluation.technicalScore;
  const prob = input.problemSolvingScore ?? evaluation.problemSolvingScore;
  const exp = input.experienceScore ?? evaluation.experienceScore;
  const cult = input.cultureFitScore ?? evaluation.cultureFitScore;

  const scores = [comm, tech, prob, exp, cult];
  for (const s of scores) {
    if (typeof s !== 'number' || !Number.isInteger(s) || s < 1 || s > 5) {
      return { error: 'All competency scores must be integers between 1 and 5.' };
    }
  }

  const recommendation = input.recommendation ?? evaluation.recommendation;
  if (!Object.values(EvaluationRecommendation).includes(recommendation)) {
    return { error: 'Invalid evaluation recommendation.' };
  }

  const comments = input.comments !== undefined ? input.comments.trim() : evaluation.comments;
  if (comments.length < 5) {
    return { error: 'Evaluation comments must be at least 5 characters.' };
  }

  const rawAverage = (comm + tech + prob + exp + cult) / 5;
  const overallScore = Math.round(rawAverage * 10) / 10;

  await prisma.candidateEvaluation.update({
    where: { id: evaluationId },
    data: {
      communicationScore: comm,
      technicalScore: tech,
      problemSolvingScore: prob,
      experienceScore: exp,
      cultureFitScore: cult,
      overallScore,
      recommendation,
      comments,
    },
  });

  revalidatePath('/dashboard/hiring/interviews');
  revalidatePath(`/dashboard/hiring/applicants/${evaluation.interview.applicationId}`);
  revalidatePath('/dashboard');

  return { success: true };
}
