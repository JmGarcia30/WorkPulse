'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { localStorageProvider } from '@/lib/storage';
import { RecruitmentDocumentStatus, EmploymentCategory } from '@prisma/client';
import { areRecruitmentDocumentsSatisfied } from '@/features/hiring/saga-requirements';

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
 * Validates candidate portal access and loads portal details securely.
 */
export async function getCandidatePortalData(organizationSlug: string, applicationId: string) {
  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      job: {
        organization: {
          slug: organizationSlug,
        },
      },
    },
    include: {
      applicant: true,
      job: {
        include: {
          organization: {
            select: {
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
    },
  });

  if (!application) {
    return null;
  }

  const category = application.job.category as EmploymentCategory;
  const evaluation = areRecruitmentDocumentsSatisfied(
    application.recruitmentDocuments,
    category
  );

  return {
    application,
    category,
    evaluation,
  };
}

/**
 * Public candidate upload action for their assigned document slots.
 * Validates strict isolation: documentId must belong to applicationId,
 * and applicationId must belong to organizationSlug.
 */
export async function submitCandidateRecruitmentDocumentAction(
  organizationSlug: string,
  applicationId: string,
  documentId: string,
  formData: FormData
) {
  // 1. Strict Tenant & Application Isolation Check
  const doc = await prisma.recruitmentDocument.findFirst({
    where: {
      id: documentId,
      applicationId: applicationId,
      application: {
        job: {
          organization: {
            slug: organizationSlug,
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
  const mimeType = file.type || 'application/octet-stream';
  const fileNameLower = file.name.toLowerCase();
  const hasValidExtension =
    fileNameLower.endsWith('.pdf') ||
    fileNameLower.endsWith('.png') ||
    fileNameLower.endsWith('.jpg') ||
    fileNameLower.endsWith('.jpeg') ||
    fileNameLower.endsWith('.webp') ||
    fileNameLower.endsWith('.doc') ||
    fileNameLower.endsWith('.docx');

  if (!ALLOWED_MIME_TYPES.includes(mimeType) && !hasValidExtension) {
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

  await prisma.recruitmentDocument.update({
    where: { id: documentId },
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
