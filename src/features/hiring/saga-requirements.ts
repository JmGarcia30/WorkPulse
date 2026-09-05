import {
  EmploymentCategory,
  RecruitmentDocumentType,
  RecruitmentDocumentStatus,
} from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export interface DocumentRequirementDefinition {
  type: RecruitmentDocumentType;
  title: string;
  description?: string;
  isRequired: boolean;
  isConditional: boolean;
  conditionalNote?: string;
  submissionTarget: string;
}

export const TEACHING_DOCUMENT_REQUIREMENTS: DocumentRequirementDefinition[] = [
  {
    type: RecruitmentDocumentType.RESUME_APPLICATION_LETTER,
    title: 'Letter of Application with Resume',
    description: 'Formal application letter addressed to the Head of the Department accompanied by full Curriculum Vitae.',
    isRequired: true,
    isConditional: false,
    submissionTarget: 'Head of the Department',
  },
  {
    type: RecruitmentDocumentType.TRANSCRIPT_OF_RECORDS,
    title: 'Transcript of Records (TOR)',
    description: 'Official collegiate / post-graduate transcript of records.',
    isRequired: true,
    isConditional: false,
    submissionTarget: 'Head of the Department',
  },
  {
    type: RecruitmentDocumentType.DIPLOMA,
    title: 'Photocopy of Diploma',
    description: 'Authenticated copy of Bachelor’s / Master’s degree diploma.',
    isRequired: true,
    isConditional: false,
    submissionTarget: 'Head of the Department',
  },
  {
    type: RecruitmentDocumentType.LET_BASIC_EDUCATION,
    title: 'Photocopy of Licensure Examination for Teachers (LET - Basic Education)',
    description: 'PRC Board Licensure examination certificate or valid PRC ID card for professional teachers.',
    isRequired: true,
    isConditional: false,
    submissionTarget: 'Head of the Department',
  },
  {
    type: RecruitmentDocumentType.PREVIOUS_EMPLOYMENT_CERT,
    title: 'Certification of Previous Employment',
    description: 'Certificate of Employment and Certificate of Good Moral Standing from previous educational employer.',
    isRequired: false,
    isConditional: true,
    conditionalNote: 'Conditional: Required if applicant has previous academic or industrial employment.',
    submissionTarget: 'Head of the Department',
  },
  {
    type: RecruitmentDocumentType.RECOMMENDATION_LETTER_1,
    title: 'Letter of Recommendation #1',
    description: 'First of three letters attesting to the applicant’s moral character, professional competence, and integrity.',
    isRequired: true,
    isConditional: false,
    submissionTarget: 'Head of the Department',
  },
  {
    type: RecruitmentDocumentType.RECOMMENDATION_LETTER_2,
    title: 'Letter of Recommendation #2',
    description: 'Second of three letters attesting to the applicant’s moral character, professional competence, and integrity.',
    isRequired: true,
    isConditional: false,
    submissionTarget: 'Head of the Department',
  },
  {
    type: RecruitmentDocumentType.RECOMMENDATION_LETTER_3,
    title: 'Letter of Recommendation #3',
    description: 'Third of three letters attesting to the applicant’s moral character, professional competence, and integrity.',
    isRequired: true,
    isConditional: false,
    submissionTarget: 'Head of the Department',
  },
  {
    type: RecruitmentDocumentType.NBI_CLEARANCE,
    title: 'NBI Clearance',
    description: 'Valid, up-to-date National Bureau of Investigation clearance without criminal or administrative derogatory record.',
    isRequired: true,
    isConditional: false,
    submissionTarget: 'Head of the Department',
  },
  {
    type: RecruitmentDocumentType.MARRIAGE_CONTRACT,
    title: 'Marriage Contract',
    description: 'PSA-authenticated marriage certificate.',
    isRequired: false,
    isConditional: true,
    conditionalNote: 'Conditional: Required if married. Mark as Not Applicable if single.',
    submissionTarget: 'Head of the Department',
  },
  {
    type: RecruitmentDocumentType.OTHER,
    title: 'Other Requirements',
    description: 'Specialized institutional certificates or supplementary documents requested by the school.',
    isRequired: false,
    isConditional: true,
    conditionalNote: 'Optional / Conditional: As may be requested by the school administration.',
    submissionTarget: 'Head of the Department',
  },
];

export const NON_TEACHING_DOCUMENT_REQUIREMENTS: DocumentRequirementDefinition[] = [
  {
    type: RecruitmentDocumentType.RESUME_APPLICATION_LETTER,
    title: 'Letter of Application with Resume',
    description: 'Formal application letter addressed to the Head of the Department accompanied by full Curriculum Vitae.',
    isRequired: true,
    isConditional: false,
    submissionTarget: 'Head of the Department',
  },
  {
    type: RecruitmentDocumentType.TRANSCRIPT_OF_RECORDS,
    title: 'Transcript of Records (TOR)',
    description: 'Official collegiate transcript of records.',
    isRequired: true,
    isConditional: false,
    submissionTarget: 'Head of the Department',
  },
  {
    type: RecruitmentDocumentType.DIPLOMA,
    title: 'Photocopy of Diploma',
    description: 'Authenticated copy of Bachelor’s degree or relevant educational diploma.',
    isRequired: true,
    isConditional: false,
    submissionTarget: 'Head of the Department',
  },
  {
    type: RecruitmentDocumentType.PROFESSIONAL_LICENSE,
    title: 'Photocopy of Professional License',
    description: 'Applicable PRC license (e.g. Registered Guidance Counselor, CPA, Registered Librarian, Nurse).',
    isRequired: false,
    isConditional: true,
    conditionalNote: 'Conditional: Required if the non-teaching position requires professional board regulation.',
    submissionTarget: 'Head of the Department',
  },
  {
    type: RecruitmentDocumentType.PREVIOUS_EMPLOYMENT_CERT,
    title: 'Certification of Previous Employment',
    description: 'Certificate of Employment and Clearance from previous employer.',
    isRequired: false,
    isConditional: true,
    conditionalNote: 'Conditional: Required if applicant has prior work experience.',
    submissionTarget: 'Head of the Department',
  },
  {
    type: RecruitmentDocumentType.RECOMMENDATION_LETTER_1,
    title: 'Letter of Recommendation #1',
    description: 'First of three letters attesting to the applicant’s moral character and workplace integrity.',
    isRequired: true,
    isConditional: false,
    submissionTarget: 'Head of the Department',
  },
  {
    type: RecruitmentDocumentType.RECOMMENDATION_LETTER_2,
    title: 'Letter of Recommendation #2',
    description: 'Second of three letters attesting to the applicant’s moral character and workplace integrity.',
    isRequired: true,
    isConditional: false,
    submissionTarget: 'Head of the Department',
  },
  {
    type: RecruitmentDocumentType.RECOMMENDATION_LETTER_3,
    title: 'Letter of Recommendation #3',
    description: 'Third of three letters attesting to the applicant’s moral character and workplace integrity.',
    isRequired: true,
    isConditional: false,
    submissionTarget: 'Head of the Department',
  },
  {
    type: RecruitmentDocumentType.NBI_CLEARANCE,
    title: 'NBI Clearance',
    description: 'Valid, up-to-date National Bureau of Investigation clearance without derogatory record.',
    isRequired: true,
    isConditional: false,
    submissionTarget: 'Head of the Department',
  },
  {
    type: RecruitmentDocumentType.MARRIAGE_CONTRACT,
    title: 'Marriage Contract',
    description: 'PSA-authenticated marriage certificate.',
    isRequired: false,
    isConditional: true,
    conditionalNote: 'Conditional: Required if married. Mark as Not Applicable if single.',
    submissionTarget: 'Head of the Department',
  },
  {
    type: RecruitmentDocumentType.OTHER,
    title: 'Other Requirements',
    description: 'Additional documentation requested by the hiring department.',
    isRequired: false,
    isConditional: true,
    conditionalNote: 'Optional / Conditional: As may be requested by the school administration.',
    submissionTarget: 'Head of the Department',
  },
];

export function getSagaDocumentRequirements(
  category: EmploymentCategory = EmploymentCategory.NON_TEACHING
): DocumentRequirementDefinition[] {
  return category === EmploymentCategory.TEACHING
    ? TEACHING_DOCUMENT_REQUIREMENTS
    : NON_TEACHING_DOCUMENT_REQUIREMENTS;
}

/**
 * Validate document completeness against the SAGA institutional policy.
 * Non-conditional required documents MUST be VERIFIED or SUBMITTED.
 * Conditional documents do NOT block progression unless explicitly required and marked PENDING without waiver.
 */
export function areRecruitmentDocumentsSatisfied(
  documents: Array<{
    type: RecruitmentDocumentType;
    status: RecruitmentDocumentStatus;
    isRequired: boolean;
    isConditional: boolean;
  }>,
  category: EmploymentCategory = EmploymentCategory.NON_TEACHING
): {
  isSatisfied: boolean;
  mandatoryCount: number;
  satisfiedMandatoryCount: number;
  missingMandatory: string[];
  conditionalPending: string[];
} {
  const definitions = getSagaDocumentRequirements(category);
  const docMap = new Map(documents.map((d) => [d.type, d]));

  const missingMandatory: string[] = [];
  const conditionalPending: string[] = [];
  let mandatoryCount = 0;
  let satisfiedMandatoryCount = 0;

  for (const def of definitions) {
    const existing = docMap.get(def.type);

    if (def.isRequired && !def.isConditional) {
      mandatoryCount++;
      const isComplete =
        existing &&
        (existing.status === RecruitmentDocumentStatus.VERIFIED ||
          existing.status === RecruitmentDocumentStatus.SUBMITTED);

      if (isComplete) {
        satisfiedMandatoryCount++;
      } else {
        missingMandatory.push(def.title);
      }
    } else if (def.isConditional) {
      // If conditional document is uploaded, check if it was rejected
      if (existing && existing.status === RecruitmentDocumentStatus.REJECTED) {
        conditionalPending.push(`${def.title} (Rejected - re-upload required)`);
      }
    }
  }

  const isSatisfied = missingMandatory.length === 0;

  return {
    isSatisfied,
    mandatoryCount,
    satisfiedMandatoryCount,
    missingMandatory,
    conditionalPending,
  };
}

/**
 * Idempotently initialize the SAGA document requirements for an application.
 */
export async function ensureRecruitmentDocumentsExist(
  applicationId: string,
  category: EmploymentCategory = EmploymentCategory.NON_TEACHING
) {
  const definitions = getSagaDocumentRequirements(category);
  const existingDocs = await prisma.recruitmentDocument.findMany({
    where: { applicationId },
    select: { type: true },
  });
  const existingTypes = new Set(existingDocs.map((d) => d.type));

  const missingToCreate = definitions.filter((def) => !existingTypes.has(def.type));

  if (missingToCreate.length > 0) {
    await prisma.recruitmentDocument.createMany({
      data: missingToCreate.map((def) => ({
        applicationId,
        type: def.type,
        title: def.title,
        status: RecruitmentDocumentStatus.PENDING,
        isRequired: def.isRequired,
        isConditional: def.isConditional,
        notes: def.conditionalNote || null,
      })),
      skipDuplicates: true,
    });
  }

  return prisma.recruitmentDocument.findMany({
    where: { applicationId },
    orderBy: { createdAt: 'asc' },
  });
}
