import { resolveHiringDocumentPolicy, applyDocumentPolicy } from '@/features/hiring/document-policy';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requestWorkspacePath } from '@/lib/tenant/server';
import { setCandidateAccessRevoked } from '@/features/careers/verification-actions';
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
import { ensureRecruitmentDocumentsExist } from '@/features/hiring/document-requirements';
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
            organization: { select: { id: true, slug: true, name: true, hiringDocumentRequirements: true } },
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
  {
    const seededDocs = await ensureRecruitmentDocumentsExist(
      application.id,
      user.organizationId
    );
    application.recruitmentDocuments = seededDocs as typeof application.recruitmentDocuments;
  }

  const hiringPolicy = resolveHiringDocumentPolicy(application.job.organization, application.job.category);
  application.recruitmentDocuments = applyDocumentPolicy(application.recruitmentDocuments, hiringPolicy);

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
    hiringPolicy,
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
    <>
    {['ORGANIZATION_ADMIN', 'HR_ADMIN'].includes(user.role) && <div className="flex gap-4 mb-4">
      <Link href={await requestWorkspacePath(`/dashboard/hiring/applicants/${applicationId}/email`)} className="text-sm underline">Preview and send HR email</Link>
      <form action={setCandidateAccessRevoked.bind(null, applicationId, true)}><button className="text-sm text-red-700 underline">Revoke candidate access</button></form>
      <form action={setCandidateAccessRevoked.bind(null, applicationId, false)}><button className="text-sm underline">Allow fresh email verification</button></form>
    </div>}
    <ApplicantProfileView
      isSaga={hiringPolicy.isSaga}
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
    </>
  );
}
