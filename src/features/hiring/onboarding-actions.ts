'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/session';
import { canManageOnboarding, canVerifyOnboardingTasks } from '@/lib/permissions/rbac';
import {
  OnboardingStatus,
  OnboardingTaskType,
  OnboardingTaskStatus,
  OfferStatus,
} from '@prisma/client';
import {
  isValidTaskTransition,
  canCompleteOnboarding,
  DEFAULT_INSTITUTIONAL_ONBOARDING_TASKS,
} from './onboarding-pipeline';
import { localStorageProvider } from '@/lib/storage';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

/**
 * Initialize onboarding for an application (idempotent).
 * Derives organization ownership from Application -> Job -> Organization.
 */
export async function initializeOnboardingAction(
  applicationId: string,
  options?: { startDate?: Date; notes?: string }
) {
  const user = await getSession();
  if (!user || !canManageOnboarding(user)) {
    return { error: 'Unauthorized to initialize onboarding.' };
  }

  // Derived tenant verification
  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      job: { organizationId: user.organizationId },
    },
    include: {
      offers: true,
      onboarding: { include: { tasks: true } },
    },
  });

  if (!application) {
    return { error: 'Application not found or access denied.' };
  }

  // Idempotency: Return existing process if already initialized
  if (application.onboarding) {
    return { success: true, onboarding: application.onboarding };
  }

  // Validate accepted offer
  const acceptedOffer = application.offers.find(
    (o) => o.status === OfferStatus.ACCEPTED
  );

  if (!acceptedOffer) {
    return {
      error:
        'Cannot initialize onboarding without an accepted offer. Please verify offer status.',
    };
  }

  const startDate = options?.startDate || acceptedOffer.startDate || new Date();
  const targetCompletionDate = new Date(
    startDate.getTime() + 14 * 24 * 60 * 60 * 1000
  );

  const newProcess = await prisma.$transaction(async (tx) => {
    const process = await tx.onboardingProcess.create({
      data: {
        applicationId,
        status: OnboardingStatus.IN_PROGRESS,
        startDate,
        targetCompletionDate,
        notes:
          options?.notes ||
          `Onboarding initialized for ${acceptedOffer.employmentType} position.`,
      },
    });

    for (const taskTemplate of DEFAULT_INSTITUTIONAL_ONBOARDING_TASKS) {
      await tx.onboardingTask.create({
        data: {
          onboardingProcessId: process.id,
          title: taskTemplate.title,
          description: taskTemplate.description,
          type: taskTemplate.type,
          status: OnboardingTaskStatus.PENDING,
          isRequired: taskTemplate.isRequired,
          dueDate: startDate,
        },
      });
    }

    return process;
  });

  revalidatePath('/dashboard/hiring/onboarding');
  revalidatePath(`/dashboard/hiring/onboarding/${newProcess.id}`);
  revalidatePath(`/dashboard/hiring/applicants/${applicationId}`);
  return { success: true, onboarding: newProcess };
}

/**
 * Update the status of an onboarding task (e.g. Verify, Reject, Submit, Waive, Reopen).
 */
export async function updateOnboardingTaskStatusAction(
  taskId: string,
  newStatus: OnboardingTaskStatus,
  reviewerNotes?: string
) {
  const user = await getSession();
  if (!user || !canVerifyOnboardingTasks(user)) {
    return { error: 'Unauthorized to update onboarding task status.' };
  }

  // Derived tenant verification: OnboardingTask -> OnboardingProcess -> Application -> Job -> Organization
  const task = await prisma.onboardingTask.findFirst({
    where: {
      id: taskId,
      onboardingProcess: {
        application: {
          job: { organizationId: user.organizationId },
        },
      },
    },
    include: {
      onboardingProcess: {
        include: {
          tasks: true,
        },
      },
    },
  });

  if (!task) {
    return { error: 'Task not found or access denied.' };
  }

  if (task.status === newStatus) {
    return { success: true };
  }

  // Check state machine transition validity
  if (!isValidTaskTransition(task.status, newStatus)) {
    return {
      error: `Invalid task transition from ${task.status} to ${newStatus}.`,
    };
  }

  const updateData: {
    status: OnboardingTaskStatus;
    reviewerNotes?: string | null;
    verifiedById?: string | null;
    verifiedAt?: Date | null;
  } = {
    status: newStatus,
  };

  if (reviewerNotes !== undefined) {
    updateData.reviewerNotes = reviewerNotes.trim() || null;
  }

  if (newStatus === OnboardingTaskStatus.VERIFIED) {
    updateData.verifiedById = user.userId;
    updateData.verifiedAt = new Date();
  } else if (newStatus === OnboardingTaskStatus.REJECTED) {
    updateData.verifiedById = user.userId;
    updateData.verifiedAt = new Date();
  } else if (
    newStatus === OnboardingTaskStatus.IN_PROGRESS ||
    newStatus === OnboardingTaskStatus.PENDING
  ) {
    updateData.verifiedById = null;
    updateData.verifiedAt = null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.onboardingTask.update({
      where: { id: taskId },
      data: updateData,
    });

    // Re-evaluate parent OnboardingProcess completion state
    const siblingTasks = await tx.onboardingTask.findMany({
      where: { onboardingProcessId: task.onboardingProcessId },
      select: { isRequired: true, status: true },
    });

    const isAllComplete = canCompleteOnboarding(siblingTasks);
    const parentProcess = task.onboardingProcess;

    if (isAllComplete && parentProcess.status !== OnboardingStatus.COMPLETED) {
      await tx.onboardingProcess.update({
        where: { id: parentProcess.id },
        data: {
          status: OnboardingStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
    } else if (!isAllComplete && parentProcess.status === OnboardingStatus.COMPLETED) {
      await tx.onboardingProcess.update({
        where: { id: parentProcess.id },
        data: {
          status: OnboardingStatus.IN_PROGRESS,
          completedAt: null,
        },
      });
    }
  });

  revalidatePath('/dashboard/hiring/onboarding');
  revalidatePath(`/dashboard/hiring/onboarding/${task.onboardingProcessId}`);
  revalidatePath(`/dashboard/hiring/applicants/${task.onboardingProcess.applicationId}`);
  return { success: true };
}

/**
 * Upload a document directly to an onboarding task in private storage.
 */
export async function uploadOnboardingTaskDocumentAction(
  taskId: string,
  formData: FormData
) {
  const user = await getSession();
  if (!user || !canManageOnboarding(user)) {
    return { error: 'Unauthorized to upload onboarding documents.' };
  }

  // Derived tenant verification
  const task = await prisma.onboardingTask.findFirst({
    where: {
      id: taskId,
      onboardingProcess: {
        application: {
          job: { organizationId: user.organizationId },
        },
      },
    },
    include: {
      onboardingProcess: true,
    },
  });

  if (!task) {
    return { error: 'Task not found or access denied.' };
  }

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) {
    return { error: 'Please select a valid document to upload.' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { error: 'File size exceeds 10MB limit.' };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      error:
        'Invalid file type. Supported formats: PDF, Word (DOC/DOCX), and Images (PNG/JPEG/WEBP).',
    };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save using private storage provider
    const { storageKey } = await localStorageProvider.upload(
      buffer,
      file.name,
      file.type
    );

    // Update task
    await prisma.onboardingTask.update({
      where: { id: taskId },
      data: {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        storageKey,
        submittedAt: new Date(),
        status: OnboardingTaskStatus.SUBMITTED,
        reviewerNotes: null,
      },
    });

    revalidatePath('/dashboard/hiring/onboarding');
    revalidatePath(`/dashboard/hiring/onboarding/${task.onboardingProcessId}`);
    revalidatePath(
      `/dashboard/hiring/applicants/${task.onboardingProcess.applicationId}`
    );
    return { success: true };
  } catch (error) {
    console.error('Error uploading onboarding task document:', error);
    return { error: 'Failed to upload document. Please try again.' };
  }
}

/**
 * Create a custom departmental onboarding task.
 */
export async function createCustomOnboardingTaskAction(
  onboardingProcessId: string,
  input: {
    title: string;
    description?: string;
    type: OnboardingTaskType;
    isRequired: boolean;
    dueDate?: string;
  }
) {
  const user = await getSession();
  if (!user || !canManageOnboarding(user)) {
    return { error: 'Unauthorized to create onboarding tasks.' };
  }

  if (!input.title || input.title.trim().length === 0) {
    return { error: 'Task title is required.' };
  }

  // Derived tenant verification
  const process = await prisma.onboardingProcess.findFirst({
    where: {
      id: onboardingProcessId,
      application: {
        job: { organizationId: user.organizationId },
      },
    },
  });

  if (!process) {
    return { error: 'Onboarding process not found or access denied.' };
  }

  const parsedDueDate = input.dueDate ? new Date(input.dueDate) : null;

  await prisma.onboardingTask.create({
    data: {
      onboardingProcessId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      type: input.type,
      status: OnboardingTaskStatus.PENDING,
      isRequired: input.isRequired,
      dueDate: parsedDueDate,
    },
  });

  revalidatePath('/dashboard/hiring/onboarding');
  revalidatePath(`/dashboard/hiring/onboarding/${onboardingProcessId}`);
  revalidatePath(`/dashboard/hiring/applicants/${process.applicationId}`);
  return { success: true };
}

/**
 * Manually mark an onboarding process as Completed.
 */
export async function completeOnboardingAction(onboardingProcessId: string) {
  const user = await getSession();
  if (!user || !canManageOnboarding(user)) {
    return { error: 'Unauthorized to complete onboarding.' };
  }

  // Derived tenant verification
  const process = await prisma.onboardingProcess.findFirst({
    where: {
      id: onboardingProcessId,
      application: {
        job: { organizationId: user.organizationId },
      },
    },
    include: {
      tasks: true,
    },
  });

  if (!process) {
    return { error: 'Onboarding process not found or access denied.' };
  }

  if (!canCompleteOnboarding(process.tasks)) {
    return {
      error:
        'Cannot complete onboarding: All required checklist tasks must be verified or waived first.',
    };
  }

  await prisma.onboardingProcess.update({
    where: { id: onboardingProcessId },
    data: {
      status: OnboardingStatus.COMPLETED,
      completedAt: new Date(),
    },
  });

  revalidatePath('/dashboard/hiring/onboarding');
  revalidatePath(`/dashboard/hiring/onboarding/${onboardingProcessId}`);
  revalidatePath(`/dashboard/hiring/applicants/${process.applicationId}`);
  return { success: true };
}
