import { Metadata } from 'next';
import { requestCandidateVerification } from '@/features/careers/verification-actions';
import Link from 'next/link';
import { getCandidatePortalData } from '@/features/careers/portal-actions';
import { CandidatePortalClient } from '@/components/careers/CandidatePortalClient';
import {
  GraduationCap,
  Briefcase,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

interface CandidatePortalPageProps {
  params: Promise<{
    organizationSlug: string;
    applicationId: string;
  }>;
}

export async function generateMetadata({
  params,
}: CandidatePortalPageProps): Promise<Metadata> {
  const { organizationSlug, applicationId } = await params;
  const data = await getCandidatePortalData(organizationSlug, applicationId);

  if (!data) {
    return { title: 'Candidate Portal | WorkPulse' };
  }

  return {
    title: `Candidate Document Portal — ${data.application.applicant.firstName} ${data.application.applicant.lastName} | ${data.application.job.organization.name}`,
    description: `Track your institutional hiring progress and upload organization document requirements for ${data.application.job.title}.`,
  };
}

export default async function CandidatePortalPage({ params }: CandidatePortalPageProps) {
  const { organizationSlug, applicationId } = await params;
  const data = await getCandidatePortalData(organizationSlug, applicationId);

  if (!data) {
    return <div className="max-w-md mx-auto p-8 space-y-4"><h1 className="text-xl font-bold">Candidate email verification</h1><p>Enter your application email. If eligible, we will send a verification link. Check your inbox; requests are limited.</p><form action={requestCandidateVerification.bind(null, organizationSlug, applicationId)} className="space-y-4"><input name="email" type="email" required autoComplete="email" aria-label="Application email" className="border rounded p-2 w-full" /><button className="rounded bg-indigo-600 text-white px-4 py-2">Send verification link</button></form></div>;
  }

  const { application, category, evaluation, isSaga } = data;
  const applicant = application.applicant;
  const job = application.job;
  const org = job.organization;
  const isTeaching = category === 'TEACHING';

  // SAGA 7-step institutional milestones
  const sagaSteps = [
    {
      step: 1,
      title: 'Submit Requirements',
      target: 'Head of Department',
      isComplete: evaluation.isSatisfied,
      isCurrent: !evaluation.isSatisfied,
    },
    {
      step: 2,
      title: 'Written Examination',
      target: 'Academic Committee',
      isComplete: application.assessments.some((a) => a.status === 'PASSED'),
      isCurrent: evaluation.isSatisfied && !application.assessments.some((a) => a.status === 'PASSED'),
    },
    ...(isTeaching
      ? [
          {
            step: 3,
            title: 'Teaching Demonstration',
            target: 'Faculty Evaluation Board',
            isComplete: application.interviews.some(
              (i) => i.type === 'TEACHING_DEMONSTRATION' && i.status === 'COMPLETED'
            ),
            isCurrent:
              application.assessments.some((a) => a.status === 'PASSED') &&
              !application.interviews.some(
                (i) => i.type === 'TEACHING_DEMONSTRATION' && i.status === 'COMPLETED'
              ),
          },
        ]
      : []),
    {
      step: isTeaching ? 4 : 3,
      title: 'HOD Interview',
      target: 'Head of Department',
      isComplete: application.interviews.some(
        (i) => i.type === 'HEAD_OF_DEPARTMENT' && i.status === 'COMPLETED'
      ),
      isCurrent: false,
    },
    {
      step: isTeaching ? 5 : 4,
      title: 'President Final Interview',
      target: 'Office of the President',
      isComplete: application.interviews.some(
        (i) => i.type === 'PRESIDENT_FINAL' && i.status === 'COMPLETED'
      ),
      isCurrent: false,
    },
    {
      step: isTeaching ? 6 : 5,
      title: 'Contract Signing',
      target: 'President & Candidate',
      isComplete: application.offers.some((o) => o.status === 'ACCEPTED'),
      isCurrent: false,
    },
    {
      step: isTeaching ? 7 : 6,
      title: 'Orientation & Policies',
      target: 'Institutional Administration',
      isComplete: application.status === 'HIRED',
      isCurrent: false,
    },
  ];

  const steps = isSaga ? sagaSteps : [
    { step: 1, title: 'Document requirements', target: 'Hiring team', isComplete: evaluation.isSatisfied, isCurrent: !evaluation.isSatisfied },
    { step: 2, title: 'Application review', target: 'Hiring team', isComplete: application.offers.some(o => o.status === 'ACCEPTED'), isCurrent: evaluation.isSatisfied && !application.offers.some(o => o.status === 'ACCEPTED') },
    { step: 3, title: 'Offer acceptance', target: 'Hiring team', isComplete: application.offers.some(o => o.status === 'ACCEPTED'), isCurrent: false },
    { step: 4, title: 'Onboarding', target: 'Hiring team', isComplete: application.onboarding?.status === 'COMPLETED', isCurrent: application.status === 'HIRED' && application.onboarding?.status !== 'COMPLETED' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Back Link */}
      <div className="flex items-center justify-between">
        <Link
          href={organizationSlug === 'saga' || organizationSlug === 'st-aloysius' ? '/saga#careers' : `/careers/${organizationSlug}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition"
        >
          <ArrowLeft className="h-4 w-4 text-[#D9A928]" /> Return to {org.name} Workspace
        </Link>
        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span>Authenticated Candidate Session</span>
        </div>
      </div>

      {/* Hero Card */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {org.name}
              </span>
              <span className="text-xs text-slate-400">•</span>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Application #{application.id.slice(-6).toUpperCase()}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
              {applicant.firstName} {applicant.lastName}
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Applying for <strong className="text-slate-900 dark:text-slate-200">{job.title}</strong> ({job.department})
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                isTeaching
                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
              }`}
            >
              {isTeaching ? (
                <>
                  <GraduationCap className="h-3.5 w-3.5" />
                  <span>{isSaga ? 'SAGA Faculty (Teaching)' : 'Teaching'}</span>
                </>
              ) : (
                <>
                  <Briefcase className="h-3.5 w-3.5" />
                  <span>{isSaga ? 'SAGA Staff (Non-Teaching)' : 'Non-Teaching'}</span>
                </>
              )}
            </span>
          </div>
        </div>

        {/* SAGA Institutional Stepper */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider dark:text-slate-200">
              {isSaga ? 'SAGA Institutional Hiring Process' : 'Application progress'}
            </h3>
            <span className="text-[11px] text-slate-400">
              {isSaga ? 'Governed by SAGA Institutional Hiring Policy' : 'Requirements set by the hiring organization'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {steps.map((s) => (
              <div
                key={s.step}
                className={`rounded-xl border p-2.5 text-center transition-all ${
                  s.isComplete
                    ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/20'
                    : s.isCurrent
                    ? 'border-indigo-400 bg-indigo-50/60 dark:border-indigo-800 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/50'
                }`}
              >
                <div className="flex items-center justify-center mb-1">
                  {s.isComplete ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                        s.isCurrent
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {s.step}
                    </span>
                  )}
                </div>
                <p className="text-[10px] font-bold leading-tight text-slate-800 dark:text-slate-200">
                  {s.title}
                </p>
                <p className="text-[9px] text-slate-400 truncate mt-0.5">
                  {s.target}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Interactive Checklist Section */}
      <CandidatePortalClient
        isSaga={isSaga}
        organizationSlug={organizationSlug}
        applicationId={application.id}
        initialDocuments={application.recruitmentDocuments}
        onboarding={application.onboarding}
        category={category}
        applicantName={`${applicant.firstName} ${applicant.lastName}`}
        jobTitle={job.title}
        orgName={org.name}
      />
    </div>
  );
}
