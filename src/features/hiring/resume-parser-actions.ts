'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/session';
import { canManageJobs } from '@/lib/permissions/rbac';
import { localStorageProvider } from '@/lib/storage';
import { extractResumeText } from '@/lib/ai/extract-text';
import { parseResumeWithAI } from '@/lib/ai/parse-resume';
import { scoreCandidateMatch } from '@/lib/ai/match-candidate';
import type { RequirementType } from '@prisma/client';

/**
 * Parse a resume document using AI and store structured results.
 * Also scores the candidate against the job's requirements.
 *
 * Idempotent: re-parsing overwrites previous results for the same document.
 */
export async function parseResumeAction(
  documentId: string
): Promise<
  | { success: true; matchScore: number; skillsCount: number }
  | { error: string }
> {
  const user = await getSession();
  if (!user || !canManageJobs(user)) {
    return { error: 'Unauthorized to parse resumes.' };
  }

  // 1. Load document with tenant verification
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      application: {
        include: {
          job: {
            include: {
              structuredReqs: true,
            },
          },
        },
      },
    },
  });

  if (!document || !document.application) {
    return { error: 'Document not found or access denied.' };
  }

  // Multi-tenant check
  if (document.application.job.organizationId !== user.organizationId) {
    return { error: 'Document not found or access denied.' };
  }

  // 2. Read file from storage
  let fileBuffer: Buffer;
  try {
    const { buffer } = await localStorageProvider.get(document.storageKey);
    fileBuffer = buffer;
  } catch {
    return { error: 'Failed to read resume file from storage.' };
  }

  // 3. Extract text
  let rawText: string;
  try {
    rawText = await extractResumeText(fileBuffer, document.fileType);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown extraction error';
    return { error: `Failed to extract text from resume: ${message}` };
  }

  if (!rawText || rawText.length < 20) {
    return {
      error:
        'Could not extract meaningful text from the resume. The file may be image-based or empty.',
    };
  }

  // 4. Parse with AI
  let parsedData;
  try {
    parsedData = await parseResumeWithAI(rawText);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown AI parsing error';

    // Store the error for debugging
    await prisma.parsedResume.upsert({
      where: { documentId },
      create: {
        documentId,
        rawText,
        parseError: message,
        skills: [],
        education: [],
        workExperience: [],
        certifications: [],
        languages: [],
      },
      update: {
        rawText,
        parseError: message,
      },
    });

    return { error: `AI parsing failed: ${message}` };
  }

  // 5. Score against job requirements
  const requirements = document.application.job.structuredReqs.map(
    (req) => ({
      id: req.id,
      name: req.name,
      type: req.type as RequirementType,
      description: req.description,
      isRequired: req.isRequired,
    })
  );

  const matchResult = scoreCandidateMatch(parsedData, requirements);

  // 6. Upsert parsed resume record
  const upsertData = {
    documentId,
    rawText,
    summary: parsedData.summary,
    skills: JSON.parse(JSON.stringify(parsedData.skills)) as unknown as
      | import('@prisma/client').Prisma.InputJsonValue,
    education: JSON.parse(JSON.stringify(parsedData.education)) as unknown as
      | import('@prisma/client').Prisma.InputJsonValue,
    workExperience: JSON.parse(
      JSON.stringify(parsedData.workExperience)
    ) as unknown as import('@prisma/client').Prisma.InputJsonValue,
    certifications: JSON.parse(
      JSON.stringify(parsedData.certifications)
    ) as unknown as import('@prisma/client').Prisma.InputJsonValue,
    languages: JSON.parse(JSON.stringify(parsedData.languages)) as unknown as
      | import('@prisma/client').Prisma.InputJsonValue,
    totalExperienceYears: parsedData.totalExperienceYears,
    matchScore: matchResult.matchScore,
    matchDetails: JSON.parse(
      JSON.stringify(matchResult.matchDetails)
    ) as unknown as import('@prisma/client').Prisma.InputJsonValue,
  };

  await prisma.parsedResume.upsert({
    where: { documentId },
    create: upsertData,
    update: { ...upsertData, parseError: null },
  });

  // 7. Revalidate
  revalidatePath(
    `/dashboard/hiring/applicants/${document.applicationId}`
  );

  return {
    success: true,
    matchScore: matchResult.matchScore,
    skillsCount: parsedData.skills.length,
  };
}
