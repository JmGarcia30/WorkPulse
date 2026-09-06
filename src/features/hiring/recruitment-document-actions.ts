'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/session';
import { canManageRecruitmentDocuments } from '@/lib/permissions/rbac';
import { RecruitmentDocumentStatus, OnboardingTaskStatus } from '@prisma/client';
import { ensureRecruitmentDocumentsExist } from './saga-requirements';
import { RECRUITMENT_DOC_TO_ONBOARDING_TITLE_MAP } from './onboarding-pipeline';
import { localStorageProvider } from '@/lib/storage';
import { sendDocumentRejectedEmail, sendDocumentVerifiedEmail } from '@/lib/email';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function safeRevalidatePath(path: string) {
  try {
    revalidatePath(path);
  } catch {
    // Non-HTTP test runner fallback
  }
}

/**
 * Initialize all standard SAGA institutional document requirements for an application.
 * Derives organization ownership from Application -> Job -> Organization.
 */
export async function initializeRecruitmentDocumentsAction(applicationId: string) {
  const user = await getSession();
  if (!user || !canManageRecruitmentDocuments(user)) {
    return { error: 'Unauthorized to initialize recruitment documents.' };
  }

  // Tenant validation
  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      job: { organizationId: user.organizationId },
    },
    include: { job: true },
  });

  if (!application) {
    return { error: 'Application not found or access denied.' };
  }

  const docs = await ensureRecruitmentDocumentsExist(application.id, application.job.category);

  safeRevalidatePath(`/dashboard/hiring/applicants/${applicationId}`);
  return { success: true, count: docs.length };
}

/**
 * Verify a recruitment document submitted by the candidate.
 */
export async function verifyRecruitmentDocumentAction(
  documentId: string,
  reviewerNotes?: string
) {
  const user = await getSession();
  if (!user || !canManageRecruitmentDocuments(user)) {
    return { error: 'Unauthorized to verify recruitment documents.' };
  }

  const doc = await prisma.recruitmentDocument.findFirst({
    where: {
      id: documentId,
      application: {
        job: { organizationId: user.organizationId },
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
    return { error: 'Document not found or access denied.' };
  }

  await prisma.recruitmentDocument.update({
    where: { id: documentId },
    data: {
      status: RecruitmentDocumentStatus.VERIFIED,
      verifiedAt: new Date(),
      verifiedById: user.userId,
      notes: reviewerNotes ? reviewerNotes.trim() : doc.notes,
    },
  });

  // Automatically sync verified credential into candidate's active onboarding checklist
  try {
    const onboarding = await prisma.onboardingProcess.findUnique({
      where: { applicationId: doc.applicationId },
      include: { tasks: true },
    });

    if (onboarding) {
      for (const [docType, titlePatterns] of Object.entries(RECRUITMENT_DOC_TO_ONBOARDING_TITLE_MAP)) {
        if (doc.type === docType) {
          const matchingTask = onboarding.tasks.find((t) =>
            titlePatterns.some(
              (p) =>
                t.title.toLowerCase().includes(p.toLowerCase()) ||
                p.toLowerCase().includes(t.title.toLowerCase())
            )
          );

          if (matchingTask) {
            await prisma.onboardingTask.update({
              where: { id: matchingTask.id },
              data: {
                status: OnboardingTaskStatus.VERIFIED,
                fileName: doc.fileName || matchingTask.fileName,
                fileType: doc.fileType || matchingTask.fileType,
                fileSize: doc.fileSize || matchingTask.fileSize,
                storageKey: doc.storageKey || matchingTask.storageKey,
                verifiedAt: new Date(),
                verifiedById: user.userId,
                reviewerNotes:
                  reviewerNotes?.trim() ||
                  doc.notes ||
                  'Auto-verified from verified SAGA Recruitment Document requirements.',
              },
            });
          }
        }
      }
    }
  } catch (syncErr) {
    console.warn('[Recruitment Document Action] Auto-sync to onboarding skipped:', syncErr);
  }

  // Free notification to candidate
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const orgSlug = doc.application.job.organization.slug;
  const portalUrl = `${baseUrl}/careers/${orgSlug}/portal/${doc.applicationId}`;

  try {
    await sendDocumentVerifiedEmail({
      to: doc.application.applicant.email,
      candidateName: `${doc.application.applicant.firstName} ${doc.application.applicant.lastName}`,
      documentTitle: doc.title,
      organizationName: doc.application.job.organization.name,
      portalUrl,
    });
  } catch (err) {
    console.warn('[Recruitment Document Action] Failed to send verification email notice:', err);
  }

  safeRevalidatePath(`/dashboard/hiring/applicants/${doc.applicationId}`);
  safeRevalidatePath(`/careers/${orgSlug}/portal/${doc.applicationId}`);
  return { success: true };
}

/**
 * Reject or flag a recruitment document (e.g. blurry scan, incomplete pages, illegible seals).
 * Updates status to REJECTED, records the reviewer's feedback note, and sends notification email.
 */
export async function rejectRecruitmentDocumentAction(
  documentId: string,
  rejectionReason: string
) {
  const user = await getSession();
  if (!user || !canManageRecruitmentDocuments(user)) {
    return { error: 'Unauthorized to reject recruitment documents.' };
  }

  if (!rejectionReason || !rejectionReason.trim()) {
    return { error: 'Please provide a clear rejection or resubmission reason for the candidate.' };
  }

  const doc = await prisma.recruitmentDocument.findFirst({
    where: {
      id: documentId,
      application: {
        job: { organizationId: user.organizationId },
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
    return { error: 'Document not found or access denied.' };
  }

  await prisma.recruitmentDocument.update({
    where: { id: documentId },
    data: {
      status: RecruitmentDocumentStatus.REJECTED,
      notes: rejectionReason.trim(),
      verifiedAt: null,
      verifiedById: null,
    },
  });

  // Free notification to candidate with portal link
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const orgSlug = doc.application.job.organization.slug;
  const portalUrl = `${baseUrl}/careers/${orgSlug}/portal/${doc.applicationId}`;

  try {
    await sendDocumentRejectedEmail({
      to: doc.application.applicant.email,
      candidateName: `${doc.application.applicant.firstName} ${doc.application.applicant.lastName}`,
      documentTitle: doc.title,
      rejectionReason: rejectionReason.trim(),
      portalUrl,
      organizationName: doc.application.job.organization.name,
    });
  } catch (err) {
    console.warn('[Recruitment Document Action] Failed to send rejection email notice:', err);
  }

  safeRevalidatePath(`/dashboard/hiring/applicants/${doc.applicationId}`);
  safeRevalidatePath(`/careers/${orgSlug}/portal/${doc.applicationId}`);
  return { success: true };
}

/**
 * Update the status of a recruitment document (e.g. mark conditional as NOT_APPLICABLE).
 */
export async function updateRecruitmentDocumentStatusAction(
  documentId: string,
  status: RecruitmentDocumentStatus,
  notes?: string
) {
  const user = await getSession();
  if (!user || !canManageRecruitmentDocuments(user)) {
    return { error: 'Unauthorized to modify recruitment documents.' };
  }

  const doc = await prisma.recruitmentDocument.findFirst({
    where: {
      id: documentId,
      application: {
        job: { organizationId: user.organizationId },
      },
    },
  });

  if (!doc) {
    return { error: 'Document not found or access denied.' };
  }

  const updateData: {
    status: RecruitmentDocumentStatus;
    notes?: string | null;
    verifiedAt?: Date | null;
    verifiedById?: string | null;
  } = {
    status,
    notes: notes !== undefined ? notes.trim() : doc.notes,
  };

  if (status === RecruitmentDocumentStatus.VERIFIED) {
    updateData.verifiedAt = new Date();
    updateData.verifiedById = user.userId;
  } else if (status === RecruitmentDocumentStatus.PENDING) {
    updateData.verifiedAt = null;
    updateData.verifiedById = null;
  }

  await prisma.recruitmentDocument.update({
    where: { id: documentId },
    data: updateData,
  });

  safeRevalidatePath(`/dashboard/hiring/applicants/${doc.applicationId}`);
  return { success: true };
}

/**
 * Upload a document file to attach to a recruitment document requirement (from HR side).
 */
export async function uploadRecruitmentDocumentAction(
  documentId: string,
  formData: FormData
) {
  const user = await getSession();
  if (!user || !canManageRecruitmentDocuments(user)) {
    return { error: 'Unauthorized to upload recruitment documents.' };
  }

  const doc = await prisma.recruitmentDocument.findFirst({
    where: {
      id: documentId,
      application: {
        job: { organizationId: user.organizationId },
      },
    },
  });

  if (!doc) {
    return { error: 'Document not found or access denied.' };
  }

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) {
    return { error: 'Please select a valid document file.' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { error: 'File size exceeds maximum allowed limit of 10MB.' };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      error: 'Invalid file format. Supported: PDF, Word (DOC/DOCX), JPG, PNG, WEBP.',
    };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const uploadResult = await localStorageProvider.upload(
    buffer,
    `saga-doc-${doc.applicationId}-${doc.type}-${file.name}`,
    file.type
  );

  await prisma.recruitmentDocument.update({
    where: { id: documentId },
    data: {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
      storageKey: uploadResult.storageKey,
      status: RecruitmentDocumentStatus.SUBMITTED,
    },
  });

  safeRevalidatePath(`/dashboard/hiring/applicants/${doc.applicationId}`);
  return { success: true };
}
