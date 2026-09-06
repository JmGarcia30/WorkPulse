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
  getSagaOnboardingTaskTemplates,
  RECRUITMENT_DOC_TO_ONBOARDING_TITLE_MAP,
} from './onboarding-pipeline';
import { RecruitmentDocumentStatus, Prisma } from '@prisma/client';
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
 * Transaction helper to create SAGA-compliant onboarding process and category-tailored tasks.
 * Auto-recognizes and carries forward already verified RecruitmentDocument credentials.
 */
export async function createSagaOnboardingProcessInTx(
  tx: Prisma.TransactionClient,
  application: {
    id: string;
    job: { category: string };
    recruitmentDocuments?: Array<{
      type: string;
      status: string;
      fileName?: string | null;
      fileType?: string | null;
      fileSize?: number | null;
      storageKey?: string | null;
      verifiedAt?: Date | null;
      verifiedById?: string | null;
      notes?: string | null;
    }>;
  },
  acceptedOffer: {
    startDate?: Date | null;
    employmentType?: string | null;
    contractExecutedAt?: Date | null;
  } | null,
  startDate: Date,
  notes?: string
) {
  const category = (application.job.category === 'TEACHING' ? 'TEACHING' : 'NON_TEACHING') as 'TEACHING' | 'NON_TEACHING';
  const targetCompletionDate = new Date(
    startDate.getTime() + 14 * 24 * 60 * 60 * 1000
  );

  const process = await tx.onboardingProcess.create({
    data: {
      applicationId: application.id,
      status: OnboardingStatus.IN_PROGRESS,
      startDate,
      targetCompletionDate,
      notes:
        notes ||
        `SAGA ${category === 'TEACHING' ? 'Faculty' : 'Staff'} Onboarding initialized for ${acceptedOffer?.employmentType || 'institutional'} appointment.`,
    },
  });

  const templates = getSagaOnboardingTaskTemplates(category);

  for (const template of templates) {
    let initialStatus: OnboardingTaskStatus = OnboardingTaskStatus.PENDING;
    let fileName: string | null = null;
    let fileType: string | null = null;
    let fileSize: number | null = null;
    let storageKey: string | null = null;
    let verifiedAt: Date | null = null;
    let verifiedById: string | null = null;
    let reviewerNotes: string | null = null;

    // Check if corresponding RecruitmentDocument exists
    if (template.matchedRecruitmentDocType && application.recruitmentDocuments) {
      const match = application.recruitmentDocuments.find(
        (d) => d.type === template.matchedRecruitmentDocType
      );

      if (match) {
        if (match.status === RecruitmentDocumentStatus.VERIFIED) {
          initialStatus = OnboardingTaskStatus.VERIFIED;
          fileName = match.fileName || null;
          fileType = match.fileType || null;
          fileSize = match.fileSize || null;
          storageKey = match.storageKey || null;
          verifiedAt = match.verifiedAt || new Date();
          verifiedById = match.verifiedById || null;
          reviewerNotes =
            match.notes ||
            'Auto-verified from verified SAGA Recruitment Document requirements.';
        } else if (match.status === RecruitmentDocumentStatus.SUBMITTED) {
          initialStatus = OnboardingTaskStatus.SUBMITTED;
          fileName = match.fileName || null;
          fileType = match.fileType || null;
          fileSize = match.fileSize || null;
          storageKey = match.storageKey || null;
          reviewerNotes =
            'Auto-referenced from candidate recruitment document submission.';
        }
      }
    }

    // Auto-recognize executed institutional contract
    if (
      template.title === 'Institutional Employment Contract Execution & Signing' &&
      acceptedOffer
    ) {
      initialStatus = OnboardingTaskStatus.VERIFIED;
      verifiedAt = acceptedOffer.contractExecutedAt || new Date();
      reviewerNotes =
        'Auto-verified from executed institutional employment contract.';
    }

    await tx.onboardingTask.create({
      data: {
        onboardingProcessId: process.id,
        title: template.title,
        description: template.description,
        type: template.type,
        status: initialStatus,
        isRequired: template.isRequired,
        dueDate: startDate,
        fileName,
        fileType,
        fileSize,
        storageKey,
        verifiedAt,
        verifiedById,
        reviewerNotes,
      },
    });
  }

  return process;
}

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
      job: { select: { organizationId: true, category: true } },
      offers: true,
      recruitmentDocuments: true,
      onboarding: { include: { tasks: true } },
    },
  });

  if (!application) {
    return { error: 'Application not found or access denied.' };
  }

  // Idempotency: Return existing process if already initialized
  if (application.onboarding) {
    // If onboarding already exists, auto-sync any newly verified recruitment documents
    await syncOnboardingWithRecruitmentDocsAction(applicationId);
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

  const newProcess = await prisma.$transaction(async (tx) => {
    return createSagaOnboardingProcessInTx(
      tx,
      application,
      acceptedOffer,
      startDate,
      options?.notes
    );
  });

  revalidatePath('/dashboard/hiring/onboarding');
  revalidatePath(`/dashboard/hiring/onboarding/${newProcess.id}`);
  revalidatePath(`/dashboard/hiring/applicants/${applicationId}`);
  return { success: true, onboarding: newProcess };
}

/**
 * Automatically syncs and reconciles an onboarding checklist with the authoritative
 * SAGA Recruitment Document requirements.
 * Ensures verified credentials (TOR, Diploma, LET, NBI) carry over without duplicate uploads.
 */
export async function syncOnboardingWithRecruitmentDocsAction(applicationId: string) {
  const user = await getSession();
  if (!user || !canManageOnboarding(user)) {
    return { error: 'Unauthorized to reconcile onboarding documents.' };
  }

  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      job: { organizationId: user.organizationId },
    },
    include: {
      job: { select: { category: true } },
      recruitmentDocuments: true,
      offers: true,
      onboarding: { include: { tasks: true } },
    },
  });

  if (!application || !application.onboarding) {
    return { error: 'No active onboarding process found to reconcile.' };
  }

  const isTeaching = application.job.category === 'TEACHING';
  const recDocs = application.recruitmentDocuments;
  const tasks = application.onboarding.tasks;
  const acceptedOffer = application.offers.find((o) => o.status === OfferStatus.ACCEPTED);

  let updatedCount = 0;

  for (const task of tasks) {
    // 1. Non-Teaching category enforcement: If staff role has legacy required PRC LET task, waive it
    if (!isTeaching && task.title.includes('PRC Board Certification') && task.isRequired) {
      await prisma.onboardingTask.update({
        where: { id: task.id },
        data: {
          isRequired: false,
          status: OnboardingTaskStatus.WAIVED,
          reviewerNotes: 'Waived: SAGA policy does not require PRC LET for non-teaching personnel.',
        },
      });
      updatedCount++;
      continue;
    }

    // 2. Match task to verified RecruitmentDocument
    let matchedDoc: typeof recDocs[0] | undefined;

    for (const [docType, titlePatterns] of Object.entries(RECRUITMENT_DOC_TO_ONBOARDING_TITLE_MAP)) {
      if (
        titlePatterns.some(
          (p) =>
            task.title.toLowerCase().includes(p.toLowerCase()) ||
            p.toLowerCase().includes(task.title.toLowerCase())
        )
      ) {
        matchedDoc = recDocs.find((d) => d.type === docType);
        if (matchedDoc) break;
      }
    }

    if (matchedDoc && matchedDoc.status === RecruitmentDocumentStatus.VERIFIED) {
      if (
        task.status !== OnboardingTaskStatus.VERIFIED ||
        (!task.storageKey && matchedDoc.storageKey) ||
        (!task.fileName && matchedDoc.fileName)
      ) {
        await prisma.onboardingTask.update({
          where: { id: task.id },
          data: {
            status: OnboardingTaskStatus.VERIFIED,
            fileName: matchedDoc.fileName || task.fileName,
            fileType: matchedDoc.fileType || task.fileType,
            fileSize: matchedDoc.fileSize || task.fileSize,
            storageKey: matchedDoc.storageKey || task.storageKey,
            verifiedAt: matchedDoc.verifiedAt || task.verifiedAt || new Date(),
            verifiedById: matchedDoc.verifiedById || user.userId,
            reviewerNotes:
              matchedDoc.notes ||
              'Auto-verified from verified SAGA Recruitment Document requirements.',
          },
        });
        updatedCount++;
      }
    } else if (matchedDoc && matchedDoc.status === RecruitmentDocumentStatus.SUBMITTED) {
      if (task.status === OnboardingTaskStatus.PENDING) {
        await prisma.onboardingTask.update({
          where: { id: task.id },
          data: {
            status: OnboardingTaskStatus.SUBMITTED,
            fileName: matchedDoc.fileName || task.fileName,
            fileType: matchedDoc.fileType || task.fileType,
            fileSize: matchedDoc.fileSize || task.fileSize,
            storageKey: matchedDoc.storageKey || task.storageKey,
            reviewerNotes:
              'Auto-referenced from candidate recruitment document submission.',
          },
        });
        updatedCount++;
      }
    }

    // 3. Contract signing task matching
    if (
      task.title.toLowerCase().includes('contract') &&
      acceptedOffer &&
      task.status !== OnboardingTaskStatus.VERIFIED
    ) {
      await prisma.onboardingTask.update({
        where: { id: task.id },
        data: {
          status: OnboardingTaskStatus.VERIFIED,
          verifiedAt: acceptedOffer.contractExecutedAt || new Date(),
          reviewerNotes:
            'Auto-verified from executed institutional employment contract.',
        },
      });
      updatedCount++;
    }
  }

  revalidatePath(`/dashboard/hiring/applicants/${applicationId}`);
  revalidatePath(`/dashboard/hiring/onboarding`);
  revalidatePath(`/dashboard/hiring/onboarding/${application.onboarding.id}`);

  return { success: true, updatedCount };
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
