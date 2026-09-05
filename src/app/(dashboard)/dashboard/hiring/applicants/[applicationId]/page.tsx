import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
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
} from '@/lib/permissions/rbac';
import { ApplicationStatus, OfferStatus } from '@prisma/client';
import { StatusChangeDialog } from '@/components/hiring/StatusChangeDialog';
import { ApplicationTimeline } from '@/components/hiring/ApplicationTimeline';
import { CandidateInterviewsSection } from '@/components/hiring/CandidateInterviewsSection';
import { CandidateAssessmentsSection } from '@/components/hiring/CandidateAssessmentsSection';
import { CandidateOffersSection } from '@/components/hiring/CandidateOffersSection';
import { CandidateOnboardingSection } from '@/components/hiring/CandidateOnboardingSection';
import { CandidateDocumentsSection } from '@/components/hiring/CandidateDocumentsSection';
import { ParsedResumeSection } from '@/components/hiring/ParsedResumeSection';
import { CandidateLifecycleStepper } from '@/components/hiring/CandidateLifecycleStepper';
import { HiringReadinessCard } from '@/components/hiring/HiringReadinessCard';
import { calculateHiringReadiness } from '@/features/hiring/readiness';
import { ensureRecruitmentDocumentsExist } from '@/features/hiring/saga-requirements';
import { STAGE_CONFIG } from '@/features/hiring/pipeline';
import {
  ArrowLeft,
  Mail,
  Phone,
  FileText,
  Download,
  CheckCircle2,
  Briefcase,
  Building2,
  Calendar,
  Sparkles,
  MapPin,
  Clock,
} from 'lucide-react';

interface CandidateProfilePageProps {
  params: Promise<{ applicationId: string }>;
}

export default async function CandidateProfilePage({ params }: CandidateProfilePageProps) {
  const user = await getSession();
  if (!user) return null;

  const { applicationId } = await params;

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
    application.recruitmentDocuments = seededDocs as any;
  }

  const canEditStatus = canUpdateApplicationStatus(user);
  const canManageIv = canManageInterviews(user);
  const canManageAss = canManageAssessments(user);
  const canRecordScore = canRecordAssessmentResult(user);
  const canManageOff = canManageOffers(user);
  const canApproveOff = canApproveOffer(user);
  const canManageOnb = canManageOnboarding(user);

  const candidateFullName = `${application.applicant.firstName} ${application.applicant.lastName}`;

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

  const stageConfig = STAGE_CONFIG[application.status] || {
    label: application.status,
    badgeBg: 'bg-slate-100 dark:bg-slate-800',
    badgeText: 'text-slate-700 dark:text-slate-300',
  };

  const hasAcceptedOffer = application.offers.some(
    (o) => o.status === OfferStatus.ACCEPTED
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Breadcrumb / Nav */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/hiring/applicants"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Applicants Directory</span>
          </Link>
          <span className="text-slate-300 dark:text-slate-700">/</span>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Application #{application.id.slice(0, 8)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${stageConfig.badgeBg} ${stageConfig.badgeText}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            Stage: {stageConfig.label}
          </span>
        </div>
      </div>

      {/* Candidate Command Center Header Card */}
      <div className="rounded-3xl border border-[#E8EAED] bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Candidate Avatar Initials */}
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#181A1C] text-white font-extrabold text-lg shadow-sm">
              {application.applicant.firstName[0]}
              {application.applicant.lastName[0]}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold text-[#181A1C] dark:text-slate-100">
                  {candidateFullName}
                </h1>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] ${readiness.badgeBg} ${readiness.badgeText}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {readiness.badgeLabel}
                </span>
              </div>

                {/* Role & Department & Category */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B7280] dark:text-slate-300">
                  <span className="flex items-center gap-1 font-bold text-[#181A1C] dark:text-slate-100">
                    <Briefcase className="h-3.5 w-3.5 text-[#181A1C] dark:text-white" />
                    {application.job.title}
                  </span>
                  <span className="text-[#E8EAED] dark:text-slate-700">•</span>
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-[#9CA3AF]" />
                    {application.job.department}
                  </span>
                  <span className="text-[#E8EAED] dark:text-slate-700">•</span>
                  <span
                    className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                      application.job.category === 'TEACHING'
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 ring-1 ring-indigo-500/20'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {application.job.category === 'TEACHING'
                      ? 'Faculty / Teaching'
                      : 'Non-Teaching Personnel'}
                  </span>
                  {application.job.location && (
                    <>
                      <span className="text-[#E8EAED] dark:text-slate-700">•</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-[#9CA3AF]" />
                        {application.job.location}
                      </span>
                    </>
                  )}
                </div>
            </div>
          </div>

          {/* Quick Stats / Timestamps */}
          <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-1.5 text-xs text-[#6B7280] dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-[#9CA3AF]" />
              <span>Applied {new Date(application.appliedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#9CA3AF]">
              <Clock className="h-3 w-3" />
              <span>{application.interviews.length} Interview(s) • {application.assessments.length} Assessment(s)</span>
            </div>
          </div>
        </div>

        {/* Contact Strip */}
        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-[#E8EAED] dark:border-slate-800 text-xs">
          <a
            href={`mailto:${application.applicant.email}`}
            className="inline-flex items-center gap-2 rounded-xl border border-[#E8EAED] bg-[#F8F9FA] px-3 py-1.5 font-semibold text-[#181A1C] hover:bg-[#181A1C] hover:text-white transition dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Mail className="h-3.5 w-3.5" />
            <span>{application.applicant.email}</span>
          </a>

          {application.applicant.phone && (
            <a
              href={`tel:${application.applicant.phone}`}
              className="inline-flex items-center gap-2 rounded-xl border border-[#E8EAED] bg-[#F8F9FA] px-3 py-1.5 font-semibold text-[#181A1C] hover:bg-[#181A1C] hover:text-white transition dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Phone className="h-3.5 w-3.5" />
              <span>{application.applicant.phone}</span>
            </a>
          )}
        </div>
      </div>

      {/* Visual SAGA Institutional Lifecycle Stepper */}
      <CandidateLifecycleStepper
        currentStatus={application.status}
        category={application.job.category}
        documentsSatisfied={
          readiness.checklist.find((c) => c.key === 'documents')?.isComplete
        }
        writtenExamPassed={
          readiness.checklist.find((c) => c.key === 'assessment')?.isComplete
        }
        teachingDemoSatisfactory={
          readiness.checklist.find((c) => c.key === 'teaching_demo')?.isComplete
        }
        hodInterviewCompleted={
          readiness.checklist.find((c) => c.key === 'hod_interview')?.isComplete
        }
        presidentInterviewCompleted={
          readiness.checklist.find((c) => c.key === 'president_interview')?.isComplete
        }
        hasInterviews={application.interviews.length > 0}
        hasEvaluations={application.interviews.some((i) => Boolean(i.evaluation))}
        hasAssessments={application.assessments.length > 0}
        assessmentsPassed={application.assessments.every((a) => a.status === 'PASSED')}
        hasOffer={application.offers.length > 0}
        offerAccepted={hasAcceptedOffer}
        isOnboarding={Boolean(application.onboarding)}
        onboardingCompleted={application.onboarding?.status === 'COMPLETED'}
        isReadyToHire={readiness.isReadyToHire}
      />

      {/* Main Command Center 2-Column Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column (2 Cols): Core Evaluation Details & Sub-pipelines */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI-Assisted Resume Analysis Section */}
          {application.documents.some(
            (doc) => doc.fileType === 'application/pdf' || doc.fileType.includes('wordprocessingml')
          ) && (
            <ParsedResumeSection
              documentId={
                application.documents.find(
                  (doc) => doc.fileType === 'application/pdf' || doc.fileType.includes('wordprocessingml')
                )!.id
              }
              parsedResume={(() => {
                const doc = application.documents.find((d) => d.parsedResume);
                if (!doc?.parsedResume) return null;
                const pr = doc.parsedResume;
                return {
                  summary: pr.summary,
                  skills: pr.skills as unknown as string[],
                  education: pr.education as unknown as Array<{
                    institution: string;
                    degree: string;
                    fieldOfStudy: string;
                    startDate: string;
                    endDate: string;
                  }>,
                  workExperience: pr.workExperience as unknown as Array<{
                    company: string;
                    position: string;
                    startDate: string;
                    endDate: string;
                    description: string;
                  }>,
                  certifications: pr.certifications as unknown as string[],
                  languages: pr.languages as unknown as string[],
                  totalExperienceYears: pr.totalExperienceYears,
                  matchScore: pr.matchScore,
                  matchDetails: pr.matchDetails as unknown as Array<{
                    requirementId: string;
                    requirementName: string;
                    requirementType: string;
                    isRequired: boolean;
                    matched: boolean;
                    confidence: 'high' | 'medium' | 'low';
                    evidence: string;
                  }> | null,
                  parsedAt: pr.parsedAt.toISOString(),
                  parseError: pr.parseError,
                };
              })()}
              jobRequirements={application.job.structuredReqs.map((req) => ({
                id: req.id,
                name: req.name,
                type: req.type,
                isRequired: req.isRequired,
              }))}
              canManage={canManageJobs(user)}
            />
          )}

          {/* SAGA Document Requirements Checklist */}
          <CandidateDocumentsSection
            applicationId={application.id}
            category={application.job.category}
            documents={application.recruitmentDocuments}
            canManage={canManageOnb}
            organizationSlug={application.job.organization?.slug || 'st-aloysius'}
          />

          {/* Cover Letter & Statement */}
          {application.coverLetter && (
            <div className="rounded-3xl border border-[#E8EAED] bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider dark:text-slate-400 flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#181A1C] dark:text-white" />
                Cover Letter & Statement
              </h3>
              <div className="rounded-2xl border border-[#E8EAED] bg-[#F8F9FA] p-4 text-xs text-[#181A1C] leading-relaxed whitespace-pre-line dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                {application.coverLetter}
              </div>
            </div>
          )}

          {/* Job Requirement Criteria Checklist */}
          {application.job.structuredReqs.length > 0 && (
            <div className="rounded-3xl border border-[#E8EAED] bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <h3 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider dark:text-slate-400">
                Job Qualification Criteria
              </h3>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {application.job.structuredReqs.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-start gap-2.5 rounded-2xl border border-[#E8EAED] bg-[#F8F9FA] p-3 text-xs dark:border-slate-800 dark:bg-slate-950"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#181A1C] shrink-0 dark:text-white" />
                    <div>
                      <span className="font-bold text-[#181A1C] dark:text-slate-100">
                        {req.name}
                      </span>
                      <p className="text-[11px] text-[#6B7280]">{req.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Candidate Interview Management & Evaluation Section */}
          <CandidateInterviewsSection
            applicationId={application.id}
            candidateName={candidateFullName}
            jobTitle={application.job.title}
            interviews={application.interviews}
            canManage={canManageIv}
          />

          {/* Pre-Employment Assessments Section */}
          <CandidateAssessmentsSection
            applicationId={application.id}
            candidateName={candidateFullName}
            jobTitle={application.job.title}
            assessments={application.assessments}
            organizationEvaluators={organizationUsers}
            canManage={canManageAss}
            canRecordResult={canRecordScore}
          />

          {/* Employment Offers Section */}
          <CandidateOffersSection
            applicationId={application.id}
            candidateName={candidateFullName}
            jobTitle={application.job.title}
            offers={application.offers}
            canManage={canManageOff}
            canApprove={canApproveOff}
          />

          {/* Pre-Employment Onboarding Checklist Section */}
          <CandidateOnboardingSection
            applicationId={application.id}
            candidateName={candidateFullName}
            offers={application.offers}
            onboarding={application.onboarding}
            canManage={canManageOnb}
          />
        </div>

        {/* Right Column (1 Col): Hiring Readiness Gate, Status Controller & History Timeline */}
        <div className="space-y-6">
          {/* Prominent Hiring Readiness Gate Card */}
          <HiringReadinessCard
            applicationId={application.id}
            candidateName={candidateFullName}
            jobTitle={application.job.title}
            readiness={readiness}
            canManage={canEditStatus}
            currentStatus={application.status}
          />

          {/* Status Change Control Dialog */}
          {canEditStatus ? (
            <StatusChangeDialog
              applicationId={application.id}
              currentStatus={application.status}
              isReadyToHire={readiness.isReadyToHire}
              unmetRequirements={readiness.unmetRequirements}
            />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              You are signed in with read-only permissions for status modifications.
            </div>
          )}

          {/* Uploaded Resume Document Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
              Uploaded Resume Document
            </h3>
            {application.documents.length === 0 ? (
              <p className="text-xs text-slate-500">No resume file attached.</p>
            ) : (
              application.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-950"
                >
                  <div className="truncate pr-2">
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {doc.fileName}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {(doc.fileSize / 1024).toFixed(1)} KB • {doc.fileType.split('/')[1] || 'doc'}
                    </p>
                  </div>

                  <a
                    href={`/api/resumes/${doc.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-xl bg-[#181A1C] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#2A2E33] shrink-0 transition shadow-2xs"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </a>
                </div>
              ))
            )}
          </div>

          {/* Reusable Unified Activity & Status Timeline */}
          <ApplicationTimeline
            initialStatus={application.status}
            appliedAt={application.appliedAt}
            history={application.history}
            interviews={application.interviews}
            assessments={application.assessments}
            offers={application.offers}
            onboarding={application.onboarding}
          />
        </div>
      </div>
    </div>
  );
}
