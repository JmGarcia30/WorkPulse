import { prisma } from '@/lib/db/prisma';
import {
  EmploymentCategory,
  OfferStatus,
  OnboardingTaskStatus,
  PayFrequency,
} from '@prisma/client';

export interface HiredEmployeeDraft {
  applicationId: string;
  organizationId: string;
  applicant: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    phone: string;
  };
  /** Compatibility-only policy summary; conversion resolves exact dates separately. */
  probation: {
    employmentStatus: 'PROBATIONARY';
    category: 'TEACHING' | 'NON_TEACHING';
    probationPeriodLabel: string;
    probationDurationMonths: number;
    isRenewable: boolean;
    maxRenewalDurationYears?: number;
    renewalCount: number;
    regularizationDecision: 'PENDING';
  };
  employment: {
    jobId: string;
    acceptedOfferId: string;
    jobTitle: string;
    department: string;
    employmentCategory: EmploymentCategory;
    employmentType: string;
    startDate: Date;
    salary: number;
    payFrequency: PayFrequency;
  };
  compliance: {
    onboardingProcessId?: string;
    completedAt?: Date | null;
    verifiedTasksCount: number;
    totalRequiredTasks: number;
    contractSignedByPresident: boolean;
    contractSignedByEmployee: boolean;
    contractExecutedAt?: Date | null;
  };
  audit: {
    interviewEvaluationsCount: number;
    assessmentsCompletedCount: number;
    offerApprovedById?: string | null;
    offerAcceptedDate: Date;
  };
}

export interface HiredEmployeeDraftSource {
  id: string;
  applicant: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  job: {
    id: string;
    organizationId: string;
    title: string;
    department: string;
    category: EmploymentCategory;
  };
  offers: Array<{
    id: string;
    status: OfferStatus;
    employmentType: string;
    startDate: Date;
    salary: number;
    payFrequency: PayFrequency;
    approvedById: string | null;
    contractSignedByPresident: boolean;
    contractSignedByEmployee: boolean;
    contractExecutedAt: Date | null;
    probationPeriodMonths: number | null;
    probationaryTerms: string | null;
    updatedAt: Date;
  }>;
  interviews: Array<{ status: string }>;
  assessments: Array<{ status: string }>;
  onboarding: {
    id: string;
    completedAt: Date | null;
    tasks: Array<{ isRequired: boolean; status: OnboardingTaskStatus }>;
  } | null;
}

/** Pure boundary mapper for application data loaded inside the conversion transaction. */
export function buildHiredEmployeeDraft(
  application: HiredEmployeeDraftSource
): HiredEmployeeDraft {
  const acceptedOffers = application.offers.filter(
    (offer) => offer.status === OfferStatus.ACCEPTED
  );
  if (acceptedOffers.length !== 1) {
    throw new Error(
      acceptedOffers.length === 0
        ? 'Candidate cannot be converted without an accepted employment offer.'
        : 'Candidate has multiple accepted offers. Resolve the contract records before conversion.'
    );
  }

  const acceptedOffer = acceptedOffers[0];
  const tasks = application.onboarding?.tasks ?? [];

  return {
    applicationId: application.id,
    organizationId: application.job.organizationId,
    applicant: {
      id: application.applicant.id,
      firstName: application.applicant.firstName,
      lastName: application.applicant.lastName,
      fullName: `${application.applicant.firstName} ${application.applicant.lastName}`.trim(),
      email: application.applicant.email,
      phone: application.applicant.phone,
    },
    probation: {
      employmentStatus: 'PROBATIONARY',
      category:
        application.job.category === EmploymentCategory.TEACHING
          ? 'TEACHING'
          : 'NON_TEACHING',
      probationPeriodLabel:
        application.job.category === EmploymentCategory.TEACHING
          ? '1 School Year'
          : '6 Months',
      probationDurationMonths:
        acceptedOffer.probationPeriodMonths ??
        (application.job.category === EmploymentCategory.NON_TEACHING ? 6 : 0),
      isRenewable: application.job.category === EmploymentCategory.TEACHING,
      maxRenewalDurationYears:
        application.job.category === EmploymentCategory.TEACHING ? 3 : undefined,
      renewalCount: 0,
      regularizationDecision: 'PENDING',
    },
    employment: {
      jobId: application.job.id,
      acceptedOfferId: acceptedOffer.id,
      jobTitle: application.job.title,
      department: application.job.department,
      employmentCategory: application.job.category,
      employmentType: acceptedOffer.employmentType,
      startDate: acceptedOffer.startDate,
      salary: acceptedOffer.salary,
      payFrequency: acceptedOffer.payFrequency,
    },
    compliance: {
      onboardingProcessId: application.onboarding?.id,
      completedAt: application.onboarding?.completedAt,
      verifiedTasksCount: tasks.filter(
        (task) =>
          task.status === OnboardingTaskStatus.VERIFIED ||
          task.status === OnboardingTaskStatus.WAIVED
      ).length,
      totalRequiredTasks: tasks.filter((task) => task.isRequired).length,
      contractSignedByPresident: acceptedOffer.contractSignedByPresident,
      contractSignedByEmployee: acceptedOffer.contractSignedByEmployee,
      contractExecutedAt: acceptedOffer.contractExecutedAt,
    },
    audit: {
      interviewEvaluationsCount: application.interviews.filter(
        (interview) => interview.status === 'COMPLETED'
      ).length,
      assessmentsCompletedCount: application.assessments.filter(
        (assessment) => assessment.status === 'PASSED'
      ).length,
      offerApprovedById: acceptedOffer.approvedById,
      offerAcceptedDate: acceptedOffer.updatedAt,
    },
  };
}

/**
 * Tenant-scoped preview facade retained for compatibility. Persistence must use
 * buildHiredEmployeeDraft with the transaction-loaded application instead.
 */
export async function prepareHiredEmployeeRecord(
  applicationId: string,
  organizationId: string
): Promise<HiredEmployeeDraft | null> {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, job: { organizationId } },
    include: {
      applicant: true,
      job: true,
      offers: true,
      interviews: { select: { status: true } },
      assessments: { select: { status: true } },
      onboarding: {
        include: {
          tasks: { select: { isRequired: true, status: true } },
        },
      },
    },
  });

  if (!application) return null;
  return buildHiredEmployeeDraft(application);
}
