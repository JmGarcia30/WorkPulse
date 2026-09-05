import { prisma } from '@/lib/db/prisma';
import { OfferStatus, OnboardingStatus, OnboardingTaskStatus } from '@prisma/client';

/**
 * Architectural Boundary Data Contract:
 * Represents the structured payload prepared by Recruitment / Hiring to hand over
 * to the upcoming Hired / Employee Management module.
 *
 * Hiring answers: "Should this candidate be hired?"
 * Employee Management answers: "What happens after this person becomes an employee?"
 */
export interface HiredEmployeeDraft {
  applicationId: string;
  organizationId: string;
  hiredAt: Date;

  // Personal Profile
  applicant: {
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    phone: string;
  };

  // Employment Terms & Position
  employment: {
    jobId: string;
    jobTitle: string;
    department: string;
    employmentType: string;
    startDate: Date;
    salary: number;
    payFrequency: string;
    benefitsSummary?: string | null;
  };

  // Pre-Employment Compliance & Verified Documents
  compliance: {
    onboardingProcessId?: string;
    completedAt?: Date | null;
    verifiedTasksCount: number;
    totalRequiredTasks: number;
    verifiedDocuments: Array<{
      taskId: string;
      taskTitle: string;
      fileName?: string | null;
      fileType?: string | null;
      storageKey?: string | null;
      verifiedAt?: Date | null;
    }>;
  };

  // SAGA Institutional Probationary Terms
  probation: {
    employmentStatus: 'PROBATIONARY';
    category: 'TEACHING' | 'NON_TEACHING';
    probationPeriodLabel: string;
    probationDurationMonths: number;
    startDate: Date;
    probationEndDate: Date;
    isRenewable: boolean;
    maxRenewalDurationYears?: number;
    renewalCount: number;
    regularizationDecision: 'PENDING';
  };

  // Recruitment Audit History
  audit: {
    interviewEvaluationsCount: number;
    assessmentsCompletedCount: number;
    offerApprovedById?: string | null;
    offerAcceptedDate?: Date;
  };
}

/**
 * Clean boundary extractor:
 * Gathers and formats verified candidate and onboarding data into the HiredEmployeeDraft
 * structure without introducing database schema dependencies or coupling.
 */
export async function prepareHiredEmployeeRecord(
  applicationId: string,
  organizationId: string
): Promise<HiredEmployeeDraft | null> {
  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      job: { organizationId },
    },
    include: {
      applicant: true,
      job: true,
      offers: true,
      interviews: true,
      assessments: true,
      onboarding: {
        include: {
          tasks: true,
        },
      },
    },
  });

  if (!application) return null;

  const acceptedOffer = application.offers.find(
    (o) => o.status === OfferStatus.ACCEPTED
  );

  const onboarding = application.onboarding;
  const tasks = onboarding?.tasks || [];
  const verifiedTasks = tasks.filter(
    (t) => t.status === OnboardingTaskStatus.VERIFIED || t.status === OnboardingTaskStatus.WAIVED
  );
  const requiredTasks = tasks.filter((t) => t.isRequired);

  return {
    applicationId: application.id,
    organizationId,
    hiredAt: new Date(),
    applicant: {
      id: application.applicant.id,
      firstName: application.applicant.firstName,
      lastName: application.applicant.lastName,
      fullName: `${application.applicant.firstName} ${application.applicant.lastName}`.trim(),
      email: application.applicant.email,
      phone: application.applicant.phone,
    },
    employment: {
      jobId: application.job.id,
      jobTitle: application.job.title,
      department: application.job.department,
      employmentType: acceptedOffer?.employmentType || application.job.employmentType,
      startDate: acceptedOffer?.startDate || new Date(),
      salary: acceptedOffer?.salary ? Number(acceptedOffer.salary) : 0,
      payFrequency: acceptedOffer?.payFrequency || 'MONTHLY',
      benefitsSummary: acceptedOffer?.benefits,
    },
    compliance: {
      onboardingProcessId: onboarding?.id,
      completedAt: onboarding?.completedAt,
      verifiedTasksCount: verifiedTasks.length,
      totalRequiredTasks: requiredTasks.length,
      verifiedDocuments: tasks
        .filter((t) => t.storageKey && t.status === OnboardingTaskStatus.VERIFIED)
        .map((t) => ({
          taskId: t.id,
          taskTitle: t.title,
          fileName: t.fileName,
          fileType: t.fileType,
          storageKey: t.storageKey,
          verifiedAt: t.verifiedAt,
        })),
    },
    probation: {
      employmentStatus: 'PROBATIONARY',
      category: application.job.category === 'TEACHING' ? 'TEACHING' : 'NON_TEACHING',
      probationPeriodLabel:
        application.job.category === 'TEACHING' ? '1 School Year' : '6 Months',
      probationDurationMonths: application.job.category === 'TEACHING' ? 12 : 6,
      startDate: acceptedOffer?.startDate || new Date(),
      probationEndDate: (() => {
        const d = new Date(acceptedOffer?.startDate || new Date());
        d.setMonth(d.getMonth() + (application.job.category === 'TEACHING' ? 12 : 6));
        return d;
      })(),
      isRenewable: application.job.category === 'TEACHING',
      maxRenewalDurationYears: application.job.category === 'TEACHING' ? 3 : undefined,
      renewalCount: 0,
      regularizationDecision: 'PENDING',
    },
    audit: {
      interviewEvaluationsCount: application.interviews.filter(
        (i) => i.status === 'COMPLETED'
      ).length,
      assessmentsCompletedCount: application.assessments.filter(
        (a) => a.status === 'PASSED'
      ).length,
      offerApprovedById: acceptedOffer?.approvedById,
      offerAcceptedDate: acceptedOffer?.updatedAt,
    },
  };
}
