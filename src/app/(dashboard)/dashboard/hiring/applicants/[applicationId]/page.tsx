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
import { ApplicationStatus } from '@prisma/client';
import { StatusChangeDialog } from '@/components/hiring/StatusChangeDialog';
import { ApplicationTimeline } from '@/components/hiring/ApplicationTimeline';
import { CandidateInterviewsSection } from '@/components/hiring/CandidateInterviewsSection';
import { CandidateAssessmentsSection } from '@/components/hiring/CandidateAssessmentsSection';
import { CandidateOffersSection } from '@/components/hiring/CandidateOffersSection';
import { CandidateOnboardingSection } from '@/components/hiring/CandidateOnboardingSection';
import { ParsedResumeSection } from '@/components/hiring/ParsedResumeSection';
import {
  ArrowLeft,
  Mail,
  Phone,
  FileText,
  Download,
  CheckCircle2,
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
                evaluatedBy: { select: { name: true, role: true } },
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

  const canEditStatus = canUpdateApplicationStatus(user);
  const canManageIv = canManageInterviews(user);
  const canManageAss = canManageAssessments(user);
  const canRecordScore = canRecordAssessmentResult(user);
  const canManageOff = canManageOffers(user);
  const canApproveOff = canApproveOffer(user);
  const canManageOnb = canManageOnboarding(user);

  const candidateFullName = `${application.applicant.firstName} ${application.applicant.lastName}`;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back Link */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/hiring/applicants"
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Candidate ATS Profile: {candidateFullName}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Application for position: {application.job.title}
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column: Candidate Details, Interviews, Assessments, Offers */}
        <div className="lg:col-span-2 space-y-6">
          {/* Candidate Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-base dark:bg-indigo-950 dark:text-indigo-300">
                  {application.applicant.firstName[0]}
                  {application.applicant.lastName[0]}
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {candidateFullName}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Applied on {new Date(application.appliedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <span
                className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                  application.status === ApplicationStatus.SHORTLISTED
                    ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300'
                    : application.status === ApplicationStatus.INTERVIEW
                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                    : application.status === ApplicationStatus.ASSESSMENT
                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300'
                    : application.status === ApplicationStatus.OFFER
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : application.status === ApplicationStatus.HIRED
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300'
                    : application.status === ApplicationStatus.SCREENING
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                    : application.status === ApplicationStatus.APPLIED
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                    : application.status === ApplicationStatus.REJECTED
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {application.status}
              </span>
            </div>

            {/* Contact Grid */}
            <div className="grid gap-3 sm:grid-cols-2 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span>{application.applicant.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                <span>{application.applicant.phone}</span>
              </div>
            </div>
          </div>

          {/* AI Resume Analysis */}
          {application.documents.some((doc) => doc.fileType === 'application/pdf' || doc.fileType.includes('wordprocessingml')) && (
            <ParsedResumeSection
              documentId={application.documents.find((doc) => doc.fileType === 'application/pdf' || doc.fileType.includes('wordprocessingml'))!.id}
              parsedResume={(() => {
                const doc = application.documents.find((d) => d.parsedResume);
                if (!doc?.parsedResume) return null;
                const pr = doc.parsedResume;
                return {
                  summary: pr.summary,
                  skills: pr.skills as unknown as string[],
                  education: pr.education as unknown as Array<{institution: string; degree: string; fieldOfStudy: string; startDate: string; endDate: string}>,
                  workExperience: pr.workExperience as unknown as Array<{company: string; position: string; startDate: string; endDate: string; description: string}>,
                  certifications: pr.certifications as unknown as string[],
                  languages: pr.languages as unknown as string[],
                  totalExperienceYears: pr.totalExperienceYears,
                  matchScore: pr.matchScore,
                  matchDetails: pr.matchDetails as unknown as Array<{requirementId: string; requirementName: string; requirementType: string; isRequired: boolean; matched: boolean; confidence: 'high' | 'medium' | 'low'; evidence: string}> | null,
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

          {/* Cover Letter */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400 flex items-center gap-2">
              <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Cover Letter & Statement
            </h3>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-700 leading-relaxed whitespace-pre-line dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              {application.coverLetter}
            </div>
          </div>

          {/* Job Requirement Criteria Checklist */}
          {application.job.structuredReqs.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">
                Job Qualification Criteria
              </h3>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {application.job.structuredReqs.map((req) => (
                  <div
                    key={req.id}
                    className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-950"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-indigo-600 shrink-0 dark:text-indigo-400" />
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {req.name}
                      </span>
                      <p className="text-[11px] text-slate-500">{req.type}</p>
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

        {/* Right Column: Resume Download, Status Controls & History Timeline */}
        <div className="space-y-6">
          {/* Status Change Control */}
          {canEditStatus ? (
            <StatusChangeDialog
              applicationId={application.id}
              currentStatus={application.status}
            />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              You are signed in with read-only permissions for status modifications.
            </div>
          )}

          {/* Attached Resume */}
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
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 shrink-0"
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
