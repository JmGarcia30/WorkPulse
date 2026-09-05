'use server';

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { localStorageProvider } from '@/lib/storage';
import { JobStatus, ApplicationStatus, RecruitmentDocumentType, RecruitmentDocumentStatus } from '@prisma/client';
import { ensureRecruitmentDocumentsExist } from '@/features/hiring/saga-requirements';
import { sendApplicationConfirmationEmail } from '@/lib/email';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function submitApplicationAction(formData: FormData): Promise<void> {
  const jobId = formData.get('jobId') as string;
  const firstName = (formData.get('firstName') as string)?.trim();
  const lastName = (formData.get('lastName') as string)?.trim();
  const emailRaw = (formData.get('email') as string)?.trim();
  const phone = (formData.get('phone') as string)?.trim();
  const coverLetter = (formData.get('coverLetter') as string)?.trim();
  const resumeFile = formData.get('resume') as File | null;

  // 1. Verify job & organization exist
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      organization: { select: { slug: true, careersEnabled: true, name: true } },
    },
  });

  if (!job || job.status !== JobStatus.PUBLISHED || !job.organization.careersEnabled) {
    redirect('/careers');
  }

  const orgSlug = job.organization.slug;
  const applyPath = `/careers/${orgSlug}/${job.slug}/apply`;

  if (!firstName || !lastName || !emailRaw || !phone || !coverLetter) {
    redirect(`${applyPath}?error=${encodeURIComponent('Please complete all required fields.')}`);
  }

  // 2. Strict Email Regex Validation
  if (!EMAIL_REGEX.test(emailRaw)) {
    redirect(`${applyPath}?error=${encodeURIComponent('Please enter a valid email address (e.g. candidate@example.com).')}`);
  }

  const normalizedEmail = emailRaw.toLowerCase();

  if (job.closingDate && new Date() > new Date(job.closingDate)) {
    redirect(`${applyPath}?error=${encodeURIComponent('The application deadline for this position has passed.')}`);
  }

  // 3. Case-insensitive duplicate detection for the same job
  const existingApplicant = await prisma.applicant.findFirst({
    where: {
      email: {
        equals: normalizedEmail,
        mode: 'insensitive',
      },
    },
  });

  if (existingApplicant) {
    const existingApp = await prisma.application.findUnique({
      where: {
        jobId_applicantId: {
          jobId: job.id,
          applicantId: existingApplicant.id,
        },
      },
    });

    if (existingApp) {
      redirect(
        `${applyPath}?error=${encodeURIComponent(
          'You have already submitted an active application for this job opening with this email address.'
        )}`
      );
    }
  }

  // 4. Strict Resume File Validation (PDF and DOCX only, Max 5MB)
  let documentMeta: {
    fileName: string;
    fileType: string;
    fileSize: number;
    storageKey: string;
  } | null = null;

  if (resumeFile && resumeFile.size > 0) {
    const fileNameLower = resumeFile.name.toLowerCase();
    const isPdf = fileNameLower.endsWith('.pdf');
    const isDocx = fileNameLower.endsWith('.docx');


    if (!isPdf && !isDocx) {
      redirect(
        `${applyPath}?error=${encodeURIComponent(
          'Invalid file format. Resume upload must strictly be a PDF (.pdf) or DOCX (.docx) document.'
        )}`
      );
    }

    const resolvedMimeType = isPdf
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
    if (resumeFile.size > MAX_FILE_SIZE_BYTES) {
      redirect(
        `${applyPath}?error=${encodeURIComponent('File size exceeds the maximum limit of 5MB.')}`
      );
    }

    const arrayBuffer = await resumeFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadResult = await localStorageProvider.upload(
      buffer,
      resumeFile.name,
      resolvedMimeType
    );

    documentMeta = {
      fileName: resumeFile.name,
      fileType: resolvedMimeType,
      fileSize: resumeFile.size,
      storageKey: uploadResult.storageKey,
    };
  }


  let application;
  try {
    // 5. Create or update Applicant record
    let applicant = existingApplicant;
    if (!applicant) {
      applicant = await prisma.applicant.create({
        data: {
          firstName,
          lastName,
          email: normalizedEmail,
          phone,
        },
      });
    } else {
      applicant = await prisma.applicant.update({
        where: { id: applicant.id },
        data: { firstName, lastName, phone },
      });
    }

    // 6. Create Application record
    application = await prisma.application.create({
      data: {
        jobId: job.id,
        applicantId: applicant.id,
        status: ApplicationStatus.APPLIED,
        coverLetter,
        documents: documentMeta
          ? {
              create: {
                applicantId: applicant.id,
                fileName: documentMeta.fileName,
                fileType: documentMeta.fileType,
                fileSize: documentMeta.fileSize,
                storageKey: documentMeta.storageKey,
              },
            }
          : undefined,
      },
    });

    // 7. Auto-initialize SAGA Document Requirements Checklist
    await ensureRecruitmentDocumentsExist(application.id, job.category);

    // If resume was uploaded, automatically link it to the Letter of Application with Resume requirement
    if (documentMeta) {
      await prisma.recruitmentDocument.updateMany({
        where: {
          applicationId: application.id,
          type: RecruitmentDocumentType.RESUME_APPLICATION_LETTER,
        },
        data: {
          fileName: documentMeta.fileName,
          fileType: documentMeta.fileType,
          fileSize: documentMeta.fileSize,
          storageKey: documentMeta.storageKey,
          status: RecruitmentDocumentStatus.SUBMITTED,
        },
      });
    }

    // 8. Dispatch Free Email Notification with Portal Access Link
    await sendApplicationConfirmationEmail({
      to: normalizedEmail,
      candidateName: `${firstName} ${lastName}`,
      jobTitle: job.title,
      organizationName: job.organization.name || 'St. Aloysius Gonzaga Academy',
      organizationSlug: orgSlug,
      applicationId: application.id,
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      redirect(
        `${applyPath}?error=${encodeURIComponent(
          'You have already submitted an active application for this job opening with this email address.'
        )}`
      );
    }
    throw error;
  }

  redirect(`${applyPath}?success=true&appId=${application.id}`);
}
