import { prisma } from '@/lib/db/prisma';
import {
  ApplicationStatus,
  EmployeeStatus,
  EmploymentStatus,
  Prisma,
  ProbationDecision,
  ProbationStatus,
  Role,
} from '@prisma/client';
import { buildHiredEmployeeDraft } from '@/features/hiring/employee-transition';
import {
  calculateHiringPrerequisites,
  calculateHiringReadiness,
  type ApplicationReadinessSource,
} from '@/features/hiring/readiness';
import {
  formatEmployeeNumber,
  normalizeEmployeeNumberPrefix,
  resolveInitialProbationTerms,
} from './domain';

export type EmployeeConversionErrorCode =
  | 'APPLICATION_NOT_FOUND'
  | 'INVALID_APPLICATION_STATUS'
  | 'NOT_READY'
  | 'INVALID_OFFER'
  | 'INVALID_PROBATION_DATE'
  | 'REHIRE_NOT_SUPPORTED'
  | 'INCOMPLETE_EXISTING_EMPLOYEE';

export class EmployeeConversionError extends Error {
  constructor(
    public readonly code: EmployeeConversionErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'EmployeeConversionError';
  }
}

export interface ConvertApplicationInput {
  applicationId: string;
  organizationId: string;
  actorUserId: string;
  teachingExpectedEndAt?: Date | null;
}

export interface EmployeeConversionResult {
  employeeId: string;
  employeeNumber: string;
  idempotent: boolean;
  legacyHired: boolean;
}

const applicationInclude = {
  applicant: true,
  job: { include: { organization: true } },
  offers: true,
  assessments: true,
  interviews: { include: { evaluation: true } },
  recruitmentDocuments: true,
  onboarding: { include: { tasks: true } },
  history: {
    where: { toStatus: ApplicationStatus.HIRED },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
  employee: {
    include: {
      employmentRecords: { include: { probation: true } },
    },
  },
} satisfies Prisma.ApplicationInclude;

function toReadinessSource(
  application: Prisma.ApplicationGetPayload<{ include: typeof applicationInclude }>
): ApplicationReadinessSource {
  return {
    id: application.id,
    status: application.status,
    appliedAt: application.appliedAt,
    jobCategory: application.job.category,
    applicant: application.applicant,
    recruitmentDocuments: application.recruitmentDocuments,
    interviews: application.interviews.map((interview) => ({
      id: interview.id,
      type: interview.type,
      status: interview.status,
      evaluationNotes: interview.evaluation?.comments,
      recommendation: interview.evaluation?.recommendation,
      overallScore: interview.evaluation?.overallScore,
    })),
    assessments: application.assessments.map((assessment) => ({
      id: assessment.id,
      title: assessment.title,
      type: assessment.type,
      status: assessment.status,
      passingScore: assessment.passingScore,
      score: assessment.score,
    })),
    offers: application.offers.map((offer) => ({
      id: offer.id,
      status: offer.status,
      startDate: offer.startDate,
      salary: offer.salary,
      employmentType: offer.employmentType,
      contractSignedByPresident: offer.contractSignedByPresident,
      contractSignedByEmployee: offer.contractSignedByEmployee,
    })),
    onboarding: application.onboarding
      ? {
          id: application.onboarding.id,
          status: application.onboarding.status,
          tasks: application.onboarding.tasks.map((task) => ({
            id: task.id,
            title: task.title,
            isRequired: task.isRequired,
            status: task.status,
          })),
        }
      : null,
  };
}

function assertExistingEmployeeComplete(
  employee: NonNullable<
    Prisma.ApplicationGetPayload<{ include: typeof applicationInclude }>['employee']
  >
) {
  const initialRecord = employee.employmentRecords.find(
    (record) => record.effectiveTo === null
  );
  if (!initialRecord?.probation) {
    throw new EmployeeConversionError(
      'INCOMPLETE_EXISTING_EMPLOYEE',
      'The existing Employee record is incomplete. Manual data repair is required before retrying conversion.'
    );
  }
}

async function convertInTransaction(
  tx: Prisma.TransactionClient,
  input: ConvertApplicationInput
): Promise<EmployeeConversionResult> {
  const actor = await tx.user.findFirst({
    where: {
      id: input.actorUserId,
      organizationId: input.organizationId,
      role: { in: [Role.ORGANIZATION_ADMIN, Role.HR_ADMIN] },
    },
    select: { id: true },
  });
  if (!actor) {
    throw new EmployeeConversionError(
      'APPLICATION_NOT_FOUND',
      'Application not found or access denied.'
    );
  }

  const application = await tx.application.findFirst({
    where: {
      id: input.applicationId,
      job: { organizationId: input.organizationId },
    },
    include: applicationInclude,
  });

  if (!application) {
    throw new EmployeeConversionError(
      'APPLICATION_NOT_FOUND',
      'Application not found or access denied.'
    );
  }

  if (application.employee) {
    assertExistingEmployeeComplete(application.employee);
    return {
      employeeId: application.employee.id,
      employeeNumber: application.employee.employeeNumber,
      idempotent: true,
      legacyHired: application.status === ApplicationStatus.HIRED,
    };
  }

  const existingInstitutionalEmployee = await tx.employee.findUnique({
    where: {
      organizationId_applicantId: {
        organizationId: input.organizationId,
        applicantId: application.applicantId,
      },
    },
  });
  if (existingInstitutionalEmployee) {
    throw new EmployeeConversionError(
      'REHIRE_NOT_SUPPORTED',
      `An Employee already exists for this person under a different Application (${existingInstitutionalEmployee.employeeNumber}). Rehire handling is outside H1.`
    );
  }

  if (
    application.status !== ApplicationStatus.OFFER &&
    application.status !== ApplicationStatus.HIRED
  ) {
    throw new EmployeeConversionError(
      'INVALID_APPLICATION_STATUS',
      `Only an OFFER or legacy HIRED Application can be converted. Current status: ${application.status}.`
    );
  }

  const readinessSource = toReadinessSource(application);
  const readiness =
    application.status === ApplicationStatus.HIRED
      ? calculateHiringPrerequisites(readinessSource)
      : calculateHiringReadiness(readinessSource);
  if (!readiness.isReadyToHire) {
    throw new EmployeeConversionError(
      'NOT_READY',
      `Candidate is not ready to be hired. Required prerequisites incomplete: ${readiness.unmetRequirements.join(' ')}`
    );
  }

  let draft;
  try {
    draft = buildHiredEmployeeDraft(application);
  } catch (error) {
    throw new EmployeeConversionError(
      'INVALID_OFFER',
      error instanceof Error ? error.message : 'Accepted offer data is invalid.'
    );
  }

  let probation;
  try {
    probation = resolveInitialProbationTerms({
      category: draft.employment.employmentCategory,
      startDate: draft.employment.startDate,
      teachingExpectedEndAt: input.teachingExpectedEndAt,
    });
  } catch (error) {
    throw new EmployeeConversionError(
      'INVALID_PROBATION_DATE',
      error instanceof Error ? error.message : 'Probation dates are invalid.'
    );
  }

  const now = new Date();
  const legacyHired = application.status === ApplicationStatus.HIRED;
  const hireDate = legacyHired ? application.history[0]?.createdAt ?? now : now;
  const sequenceYear = hireDate.getUTCFullYear();
  const sequence = await tx.employeeNumberSequence.upsert({
    where: {
      organizationId_year: {
        organizationId: input.organizationId,
        year: sequenceYear,
      },
    },
    create: {
      organizationId: input.organizationId,
      year: sequenceYear,
      nextValue: 2,
    },
    update: { nextValue: { increment: 1 } },
    select: { nextValue: true },
  });
  const employeeNumber = formatEmployeeNumber(
    normalizeEmployeeNumberPrefix(
      application.job.organization.employeeNumberPrefix,
      application.job.organization.slug
    ),
    sequenceYear,
    sequence.nextValue - 1
  );

  if (!legacyHired) {
    await tx.application.update({
      where: { id: application.id },
      data: { status: ApplicationStatus.HIRED },
    });
    await tx.applicationStatusHistory.create({
      data: {
        applicationId: application.id,
        fromStatus: ApplicationStatus.OFFER,
        toStatus: ApplicationStatus.HIRED,
        changedById: input.actorUserId,
      },
    });
  }

  const employee = await tx.employee.create({
    data: {
      organizationId: input.organizationId,
      sourceApplicationId: application.id,
      applicantId: draft.applicant.id,
      employeeNumber,
      firstName: draft.applicant.firstName,
      lastName: draft.applicant.lastName,
      email: draft.applicant.email,
      phone: draft.applicant.phone,
      employeeStatus: EmployeeStatus.ACTIVE,
      createdById: input.actorUserId,
    },
  });

  const employmentRecord = await tx.employmentRecord.create({
    data: {
      employeeId: employee.id,
      jobId: draft.employment.jobId,
      acceptedOfferId: draft.employment.acceptedOfferId,
      jobTitle: draft.employment.jobTitle,
      department: draft.employment.department,
      employmentCategory: draft.employment.employmentCategory,
      employmentType: draft.employment.employmentType,
      hireDate,
      startDate: draft.employment.startDate,
      salary: new Prisma.Decimal(draft.employment.salary),
      payFrequency: draft.employment.payFrequency,
      employmentStatus: EmploymentStatus.PROBATIONARY,
      effectiveFrom: draft.employment.startDate,
      createdById: input.actorUserId,
    },
  });

  await tx.probationRecord.create({
    data: {
      employeeId: employee.id,
      employmentRecordId: employmentRecord.id,
      category: draft.employment.employmentCategory,
      startedAt: draft.employment.startDate,
      expectedEndAt: probation.expectedEndAt,
      probationStatus: ProbationStatus.ACTIVE,
      renewalCount: probation.renewalCount,
      maxRenewals: probation.maxRenewals,
      decision: ProbationDecision.PENDING,
      policySnapshot: probation.policySnapshot,
    },
  });

  await tx.employeeStatusHistory.create({
    data: {
      employeeId: employee.id,
      fromStatus: null,
      toStatus: EmployeeStatus.ACTIVE,
      changedById: input.actorUserId,
      reason: legacyHired
        ? 'Employee record created from a legacy HIRED Application during H1 conversion.'
        : 'Employee record created through atomic Hiring conversion.',
    },
  });

  return {
    employeeId: employee.id,
    employeeNumber,
    idempotent: false,
    legacyHired,
  };
}

export async function convertApplicationToEmployee(
  input: ConvertApplicationInput
): Promise<EmployeeConversionResult> {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(
        (tx) => convertInTransaction(tx, input),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (error) {
      if (error instanceof EmployeeConversionError) throw error;

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await prisma.employee.findFirst({
          where: {
            sourceApplicationId: input.applicationId,
            organizationId: input.organizationId,
          },
          include: {
            employmentRecords: { include: { probation: true } },
          },
        });
        if (existing) {
          assertExistingEmployeeComplete(existing);
          return {
            employeeId: existing.id,
            employeeNumber: existing.employeeNumber,
            idempotent: true,
            legacyHired: true,
          };
        }
      }

      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034';
      if (!retryable || attempt === maxAttempts) throw error;
    }
  }

  throw new Error('Employee conversion failed after retrying the transaction.');
}
