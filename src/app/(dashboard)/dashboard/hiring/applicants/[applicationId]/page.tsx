import { notFound } from 'next/navigation';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import {
  canUpdateApplicationStatus,
  canManageInterviews,
  canManageAssessments,
  canRecordAssessmentResult,
  canManageOffers,
  canApproveOffer,
  canManageOnboarding,
  canManageJobs,
  canViewEmployees,
} from '@/lib/permissions/rbac';
import { calculateHiringReadiness } from '@/features/hiring/readiness';
import { ensureRecruitmentDocumentsExist } from '@/features/hiring/saga-requirements';
import { ApplicantProfileView } from '@/components/hiring/ApplicantProfileView';

interface CandidateProfilePageProps {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function CandidateProfilePage({
  params,
  searchParams,
}: CandidateProfilePageProps) {
  const user = await requireBackOfficeContext();
  if (!user) return null;

  const { applicationId } = await params;
  const { tab } = await searchParams;

  // Multi-tenant check: Verify application belongs to user's Organization via Job relationship
  const [application, organizationUsers] = await Promise.all([
    prisma.application.findFirst({
      where: {
        id: applicationId,
        job: {
          organizationId: user.organizationId,
        },
      },
      include: {
        applicant: true,
        job: {
          include: {
            structuredReqs: true,
            organization: { select: { slug: true, name: true } },
          },
        },
        documents: {
          include: {
            parsedResume: true,
          },
        },
        history: {
          orderBy: { createdAt: 'desc' },
          include: {
            changedBy: { select: { name: true, role: true } },
          },
        },
        interviews: {
          orderBy: { scheduledAt: 'desc' },
          include: {
            interviewer: {
              select: { id: true, name: true, email: true, role: true },
            },
            evaluation: {
              include: {
                evaluatedBy: { select: { id: true, name: true, role: true } },
              },
            },
          },
        },
        assessments: {
          orderBy: { createdAt: 'desc' },
          include: {
            evaluator: {
              select: { id: true, name: true, role: true },
            },
          },
        },
        offers: {
          orderBy: { createdAt: 'desc' },
          include: {
            createdBy: {
              select: { id: true, name: true, role: true },
            },
            approvedBy: {
              select: { id: true, name: true, role: true },
            },
          },
        },
        recruitmentDocuments: {
          orderBy: { createdAt: 'asc' },
          include: {
            verifiedBy: { select: { name: true } },
          },
        },
        onboarding: {
          include: {
            tasks: {
              orderBy: { createdAt: 'asc' },
              include: {
                verifiedBy: { select: { name: true } },
              },
            },
          },
        },
        employee: { select: { id: true } },
      },
    }),
    prisma.user.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  if (!application) {
    notFound();
  }

  // Idempotently ensure standard SAGA document checklist records are populated
  if (application.recruitmentDocuments.length === 0) {
    const seededDocs = await ensureRecruitmentDocumentsExist(
      application.id,
      application.job.category
    );
    application.recruitmentDocuments = seededDocs as typeof application.recruitmentDocuments;
  }

  const canEditStatus = canUpdateApplicationStatus(user);
  const canManageIv = canManageInterviews(user);
  const canManageAss = canManageAssessments(user);
  const canRecordScore = canRecordAssessmentResult(user);
  const canManageOff = canManageOffers(user);
  const canApproveOff = canApproveOffer(user);
  const canManageOnb = canManageOnboarding(user);
  const canManageJob = canManageJobs(user);
  const canViewEmp = canViewEmployees(user);

  // Evaluate Hiring Readiness
  const readiness = calculateHiringReadiness({
    id: application.id,
    status: application.status,
    appliedAt: application.appliedAt,
    jobCategory: application.job.category,
    applicant: application.applicant,
    recruitmentDocuments: application.recruitmentDocuments,
    interviews: application.interviews.map((iv) => ({
      id: iv.id,
      type: iv.type,
      status: iv.status,
      evaluationNotes: iv.evaluation?.comments,
      recommendation: iv.evaluation?.recommendation,
      overallScore: iv.evaluation?.overallScore,
    })),
    assessments: application.assessments.map((a) => ({
      id: a.id,
      title: a.title,
      type: a.type,
      status: a.status,
      passingScore: a.passingScore,
      score: a.score,
    })),
    offers: application.offers.map((o) => ({
      id: o.id,
      status: o.status,
      startDate: o.startDate,
      salary: Number(o.salary),
      employmentType: o.employmentType,
      contractSignedByPresident: o.contractSignedByPresident,
      contractSignedByEmployee: o.contractSignedByEmployee,
    })),
    onboarding: application.onboarding
      ? {
          id: application.onboarding.id,
          status: application.onboarding.status,
          tasks: application.onboarding.tasks.map((t) => ({
            id: t.id,
            title: t.title,
            isRequired: t.isRequired,
            status: t.status,
          })),
        }
      : null,
  });

  return (
    <ApplicantProfileView
      application={application}
      organizationUsers={organizationUsers}
      readiness={readiness}
      initialTab={tab}
      permissions={{
        canEditStatus,
        canManageIv,
        canManageAss,
        canRecordScore,
        canManageOff,
        canApproveOff,
        canManageOnb,
        canManageJobs: canManageJob,
        canViewEmployees: canViewEmp,
      }}
    />
  );
}
