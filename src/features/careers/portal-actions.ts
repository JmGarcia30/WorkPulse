'use server';

import { ensureRecruitmentDocumentsExist } from '@/features/hiring/document-requirements';
import { resolveHiringDocumentPolicy, applyDocumentPolicy } from '@/features/hiring/document-policy';
import { candidateHasAccess, candidateWriteScope, validCandidateId } from './candidate-access';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { localStorageProvider } from '@/lib/storage';
import {
  RecruitmentDocumentStatus,
  EmploymentCategory,
  OnboardingTaskStatus,
} from '@prisma/client';
import { areRecruitmentDocumentsSatisfied } from '@/features/hiring/saga-requirements';
import { databaseSlugForTenant } from '@/lib/tenant/host';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function candidateDocumentMimeType(file: File) {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const extension = file.name.toLowerCase().split('.').pop();
  return ({ pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } as Record<string, string>)[extension || ''] || 'application/octet-stream';
}

/**
 * Private portal data requires a live application-specific candidate session.
 */
export async function getCandidatePortalData(organizationSlug: string, applicationId: string) {
  if (!await candidateHasAccess(applicationId, organizationSlug)) return null;
  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      job: {
        organization: {
          slug: databaseSlugForTenant(organizationSlug),
        },
      },
    },
    include: {
      applicant: true,
      job: {
        include: {
          organization: {
            select: {
              id: true,
              hiringDocumentRequirements: true,
              name: true,
              slug: true,
              logoUrl: true,
            },
          },
        },
      },
      recruitmentDocuments: {
        orderBy: { createdAt: 'asc' },
      },
      interviews: {
        select: {
          id: true,
          type: true,
          status: true,
          scheduledAt: true,
        },
      },
      assessments: {
        select: {
          id: true,
          title: true,
          type: true,
          status: true,
        },
      },
      offers: {
        select: {
          id: true,
          status: true,
          startDate: true,
          employmentType: true,
        },
      },
      onboarding: {
        include: {
          tasks: {
            orderBy: { createdAt: 'asc' },
          },
        },
      },
    },
  });

  if (!application) {
    return null;
  }

  const category = application.job.category as EmploymentCategory;
  const hiringPolicy = resolveHiringDocumentPolicy(application.job.organization, category);
  application.recruitmentDocuments = applyDocumentPolicy(await ensureRecruitmentDocumentsExist(application.id, application.job.organizationId), hiringPolicy);
  const evaluation = areRecruitmentDocumentsSatisfied(
    application.recruitmentDocuments,
    hiringPolicy.requirements
  );

  return {
    application,
    category,
    evaluation,
    isSaga: hiringPolicy.isSaga,
  };
}

/**
 * Candidate uploads require verified ownership plus matching tenant and application.
 */
export async function submitCandidateRecruitmentDocumentAction(
  organizationSlug: string,
  applicationId: string,
  documentId: string,
  formData: FormData
) {
  if (!validCandidateId(documentId)) return { error: 'Document not found or access denied.' };
  if (!await candidateHasAccess(applicationId, organizationSlug)) return { error: 'Document not found or access denied.' };
  // 1. Strict Tenant & Application Isolation Check
  const doc = await prisma.recruitmentDocument.findFirst({
    where: {
      id: documentId,
      applicationId: applicationId,
      application: {
        job: {
          organization: {
            slug: databaseSlugForTenant(organizationSlug),
          },
        },
      },
    },
    include: {
      application: {
        include: {
          applicant: true,
          job: {
            include: {
              organization: true,
            },
          },
        },
      },
    },
  });

  if (!doc) {
    return {
      error: 'Security verification failed: Document record not found or access denied.',
    };
  }

  // Match the portal's existing upload controls on the server as well.
  if (doc.status === RecruitmentDocumentStatus.VERIFIED || doc.status === RecruitmentDocumentStatus.NOT_APPLICABLE) {
    return { error: 'Verified or waived documents cannot be replaced. Contact HR for review.' };
  }

  // 2. Validate File Presence & Size
  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) {
    return { error: 'Please choose a document file to upload.' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { error: 'File size exceeds maximum allowed limit of 10MB.' };
  }

  // Basic check for suspicious / zero-content files
  if (file.size < 512) {
    return {
      error: 'File appears damaged or empty (under 512 bytes). Please select a valid document scan.',
    };
  }

  // 3. MIME type validation
  const mimeType = candidateDocumentMimeType(file);
  const fileNameLower = file.name.toLowerCase();
  const hasValidExtension =
    fileNameLower.endsWith('.pdf') ||
    fileNameLower.endsWith('.png') ||
    fileNameLower.endsWith('.jpg') ||
    fileNameLower.endsWith('.jpeg') ||
    fileNameLower.endsWith('.webp') ||
    fileNameLower.endsWith('.doc') ||
    fileNameLower.endsWith('.docx');

  if (!ALLOWED_MIME_TYPES.includes(mimeType) || !hasValidExtension) {
    return {
      error: 'Invalid file format. Please upload PDF, Word Document (DOC/DOCX), or image (JPG, PNG, WEBP).',
    };
  }

  // 4. Upload to storage
  const buffer = Buffer.from(await file.arrayBuffer());
  const uploadResult = await localStorageProvider.upload(
    buffer,
    `candidate-upload-${applicationId}-${doc.type}-${file.name}`,
    mimeType
  );

  // 5. Update RecruitmentDocument: Transition to SUBMITTED
  // If it was previously REJECTED, append re-upload notice to notes
  let updatedNotes = doc.notes;
  if (doc.status === RecruitmentDocumentStatus.REJECTED) {
    updatedNotes = doc.notes
      ? `${doc.notes} | [Candidate re-uploaded on ${new Date().toLocaleDateString()}]`
      : `Candidate re-uploaded on ${new Date().toLocaleDateString()}`;
  }

  const updated = await prisma.recruitmentDocument.updateMany({
    where: { id: documentId, applicationId, application: await candidateWriteScope(), status: { notIn: [RecruitmentDocumentStatus.VERIFIED, RecruitmentDocumentStatus.NOT_APPLICABLE] } },
    data: {
      fileName: file.name,
      fileType: mimeType,
      fileSize: file.size,
      storageKey: uploadResult.storageKey,
      status: RecruitmentDocumentStatus.SUBMITTED,
      notes: updatedNotes,
      verifiedAt: null,
      verifiedById: null,
    },
  });
  if (!updated.count) {
    await localStorageProvider.delete(uploadResult.storageKey);
    return { error: 'Document changed during upload. Contact HR for review.' };
  }

  // Revalidate both candidate portal and HR dashboard safely
  try {
    revalidatePath(`/careers/${organizationSlug}/portal/${applicationId}`);
    revalidatePath(`/dashboard/hiring/applicants/${applicationId}`);
  } catch {
    // Gracefully ignore outside Next.js request context (e.g. CLI test runner)
  }

  return {
    success: true,
    fileName: file.name,
    status: RecruitmentDocumentStatus.SUBMITTED,
  };
}

/**
 * Upload and submit a candidate onboarding document directly through the candidate portal.
 * Validates tenant boundary, file format, stores file, and transitions task to SUBMITTED.
 */
export async function submitCandidateOnboardingDocumentAction(
  organizationSlug: string,
  applicationId: string,
  taskId: string,
  formData: FormData
) {
  if (!validCandidateId(taskId)) return { error: 'Document not found or access denied.' };
  if (!await candidateHasAccess(applicationId, organizationSlug)) return { error: 'Document not found or access denied.' };
  // Check task/application relationships after authenticating candidate ownership.
  const task = await prisma.onboardingTask.findFirst({
    where: {
      id: taskId,
      onboardingProcess: {
        applicationId,
        application: {
          job: {
            organization: {
              slug: databaseSlugForTenant(organizationSlug),
            },
          },
        },
      },
    },
  });

  if (!task) {
    return {
      error: 'Security verification failed: Onboarding task not found or access denied.',
    };
  }

  if (task.type !== 'DOCUMENT' || task.status === OnboardingTaskStatus.VERIFIED || task.status === OnboardingTaskStatus.WAIVED) {
    return { error: 'This task cannot accept a candidate document. Contact HR for review.' };
  }

  // 2. Validate file
  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) {
    return { error: 'Please choose a document file to upload.' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { error: 'File size exceeds maximum allowed limit of 10MB.' };
  }

  if (file.size < 512) {
    return {
      error: 'File appears empty or corrupted. Please select a valid document file.',
    };
  }

  const mimeType = candidateDocumentMimeType(file);
  const fileNameLower = file.name.toLowerCase();
  const hasValidExtension =
    fileNameLower.endsWith('.pdf') ||
    fileNameLower.endsWith('.png') ||
    fileNameLower.endsWith('.jpg') ||
    fileNameLower.endsWith('.jpeg') ||
    fileNameLower.endsWith('.webp') ||
    fileNameLower.endsWith('.doc') ||
    fileNameLower.endsWith('.docx');

  if (!ALLOWED_MIME_TYPES.includes(mimeType) || !hasValidExtension) {
    return {
      error: 'Invalid file format. Please upload PDF, Word Document (DOC/DOCX), or image (JPG, PNG, WEBP).',
    };
  }

  // 3. Store file securely
  const buffer = Buffer.from(await file.arrayBuffer());
  const uploadResult = await localStorageProvider.upload(
    buffer,
    `candidate-onboarding-${applicationId}-${taskId}-${file.name}`,
    mimeType
  );

  // 4. Update OnboardingTask
  const updated = await prisma.onboardingTask.updateMany({
    where: { id: taskId, onboardingProcess: { applicationId, application: await candidateWriteScope() }, type: 'DOCUMENT', status: { notIn: [OnboardingTaskStatus.VERIFIED, OnboardingTaskStatus.WAIVED] } },
    data: {
      fileName: file.name,
      fileType: mimeType,
      fileSize: file.size,
      storageKey: uploadResult.storageKey,
      status: OnboardingTaskStatus.SUBMITTED,
      submittedAt: new Date(),
      reviewerNotes: `Submitted by applicant on ${new Date().toLocaleDateString()}`,
    },
  });
  if (!updated.count) {
    await localStorageProvider.delete(uploadResult.storageKey);
    return { error: 'Task changed during upload. Contact HR for review.' };
  }

  // Revalidate both candidate portal and HR dashboard
  try {
    revalidatePath(`/careers/${organizationSlug}/portal/${applicationId}`);
    revalidatePath(`/dashboard/hiring/applicants/${applicationId}`);
    revalidatePath('/dashboard/hiring/onboarding');
  } catch {
    // Gracefully ignore outside Next.js request context
  }

  return {
    success: true,
    fileName: file.name,
    status: OnboardingTaskStatus.SUBMITTED,
  };
}
