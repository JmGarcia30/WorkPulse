import Link from 'next/link';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';
import {
  JobStatus,
  ApplicationStatus,
  InterviewStatus,
  AssessmentStatus,
  OfferStatus,
  OnboardingStatus,
  OnboardingTaskStatus,
} from '@prisma/client';
import {
  Briefcase,
  CheckCircle,
  Users,
  Clock,
  Plus,
  ArrowRight,
  History,
  Calendar,
  Award,
  FileText,
  FileCheck,
  UserCheck,
} from 'lucide-react';

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) return null;

  const orgId = user.organizationId;

  // Real Database Metrics & Recent Activities (Strictly Organization-Scoped)
  const [
    totalJobs,
    publishedJobs,
    totalApplications,
    awaitingReviewCount,
    upcomingInterviewsCount,
    completedInterviewsCount,
    awaitingEvaluationCount,
    activeAssessmentsCount,
    awaitingAssessmentReviewCount,
    activeOffersCount,
    pendingOfferApprovalCount,
    activeOnboardingCount,
    pendingOnboardingReviewCount,
    recentJobs,
    upcomingInterviews,
    statusHistoryEvents,
  ] = await Promise.all([
    prisma.job.count({ where: { organizationId: orgId } }),
    prisma.job.count({ where: { organizationId: orgId, status: JobStatus.PUBLISHED } }),
    prisma.application.count({ where: { job: { organizationId: orgId } } }),
    prisma.application.count({
      where: { job: { organizationId: orgId }, status: ApplicationStatus.APPLIED },
    }),
    prisma.interview.count({
      where: {
        application: { job: { organizationId: orgId } },
        status: InterviewStatus.SCHEDULED,
      },
    }),
    prisma.interview.count({
      where: {
        application: { job: { organizationId: orgId } },
        status: InterviewStatus.COMPLETED,
      },
    }),
    prisma.interview.count({
      where: {
        application: { job: { organizationId: orgId } },
        status: InterviewStatus.COMPLETED,
        evaluation: null,
      },
    }),
    prisma.assessment.count({
      where: {
        application: { job: { organizationId: orgId } },
        status: {
          in: [
            AssessmentStatus.ASSIGNED,
            AssessmentStatus.IN_PROGRESS,
            AssessmentStatus.SUBMITTED,
            AssessmentStatus.UNDER_REVIEW,
          ],
        },
      },
    }),
    prisma.assessment.count({
      where: {
        application: { job: { organizationId: orgId } },
        status: AssessmentStatus.SUBMITTED,
      },
    }),
    prisma.offer.count({
      where: {
        application: { job: { organizationId: orgId } },
        status: {
          in: [
            OfferStatus.DRAFT,
            OfferStatus.PENDING_APPROVAL,
            OfferStatus.APPROVED,
            OfferStatus.SENT,
          ],
        },
      },
    }),
    prisma.offer.count({
      where: {
        application: { job: { organizationId: orgId } },
        status: OfferStatus.PENDING_APPROVAL,
      },
    }),
    prisma.onboardingProcess.count({
      where: {
        application: { job: { organizationId: orgId } },
        status: OnboardingStatus.IN_PROGRESS,
      },
    }),
    prisma.onboardingTask.count({
      where: {
        onboardingProcess: {
          application: { job: { organizationId: orgId } },
        },
        status: OnboardingTaskStatus.SUBMITTED,
      },
    }),
    prisma.job.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 4,
      include: {
        _count: { select: { applications: true } },
      },
    }),
    prisma.interview.findMany({
      where: {
        application: { job: { organizationId: orgId } },
        status: InterviewStatus.SCHEDULED,
      },
      orderBy: { scheduledAt: 'asc' },
      take: 4,
      include: {
        application: {
          include: {
            applicant: { select: { firstName: true, lastName: true, email: true } },
            job: { select: { title: true } },
          },
        },
        interviewer: { select: { name: true } },
      },
    }),
    prisma.applicationStatusHistory.findMany({
      where: {
        application: {
          job: { organizationId: orgId },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        application: {
          include: {
            applicant: { select: { firstName: true, lastName: true } },
            job: { select: { title: true } },
          },
        },
        changedBy: { select: { name: true, role: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-linear-to-r from-indigo-600 to-indigo-800 p-6 text-white shadow-lg">
        <div>
          <h2 className="text-xl font-bold">Welcome back, {user.name}!</h2>
          <p className="text-xs text-indigo-100 mt-1">
            WorkPulse SaaS Workforce Operations • Hiring Foundation
          </p>
        </div>
        <Link
          href="/dashboard/hiring/jobs/new"
          className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 shadow-sm transition"
        >
          <Plus className="h-4 w-4" />
          Post New Job Opening
        </Link>
      </div>

      {/* Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">Active Openings</span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle className="h-5 w-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">{publishedJobs}</p>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
            Published openings receiving submissions.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">Total Applicants</span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">{totalApplications}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Candidate profiles in recruitment pipeline.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">Active Assessments</span>
            <div className="rounded-xl bg-purple-50 p-2 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400">
              <Award className="h-5 w-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">{activeAssessmentsCount}</p>
          <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
            {awaitingAssessmentReviewCount} awaiting review.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">Active Offers</span>
            <div className="rounded-xl bg-amber-50 p-2 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
              <FileCheck className="h-5 w-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">{activeOffersCount}</p>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
            {pendingOfferApprovalCount} awaiting approval.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400">New Hire Onboarding</span>
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <UserCheck className="h-5 w-5" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">{activeOnboardingCount}</p>
          <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
            {pendingOnboardingReviewCount} document reviews pending.
          </p>
        </div>
      </div>

      {/* Activity & Job Feed Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Job Openings */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Job Postings
            </h3>
            <Link
              href="/dashboard/hiring/jobs"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 flex items-center gap-1 dark:text-indigo-400"
            >
              View All <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {recentJobs.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">No jobs posted yet.</p>
            ) : (
              recentJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/60"
                >
                  <div>
                    <Link
                      href={`/dashboard/hiring/jobs/${job.id}`}
                      className="text-xs font-bold text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400"
                    >
                      {job.title}
                    </Link>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      <span>{job.department}</span>
                      <span>•</span>
                      <span>{job._count.applications} apps</span>
                    </div>
                  </div>

                  <span
                    className={`rounded-md px-2.5 py-1 text-[10px] font-bold ${
                      job.status === JobStatus.PUBLISHED
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : job.status === JobStatus.DRAFT
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {job.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming Interviews Feed */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Upcoming Interviews
            </h3>
            <Link
              href="/dashboard/hiring/interviews"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 flex items-center gap-1 dark:text-indigo-400"
            >
              All Interviews <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {upcomingInterviews.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">
                No upcoming interviews scheduled.
              </p>
            ) : (
              upcomingInterviews.map((iv) => (
                <div
                  key={iv.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/60 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/dashboard/hiring/applicants/${iv.application.id}`}
                      className="text-xs font-bold text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400"
                    >
                      {iv.application.applicant.firstName} {iv.application.applicant.lastName}
                    </Link>
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      {iv.type.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Clock className="h-3 w-3 text-slate-400" />
                    {new Date(iv.scheduledAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    at {new Date(iv.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                    • with {iv.interviewer.name}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Meaningful Hiring Activity Stream */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <History className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> Recent Audit Activity
            </h3>
            <Link
              href="/dashboard/hiring/applicants"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 flex items-center gap-1 dark:text-indigo-400"
            >
              All Applicants <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {statusHistoryEvents.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-6">
                No recent status modifications recorded.
              </p>
            ) : (
              statusHistoryEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 dark:border-slate-800 dark:bg-slate-950/60"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs shrink-0 dark:bg-emerald-950 dark:text-emerald-300">
                    ✓
                  </div>
                  <div className="text-xs space-y-0.5">
                    <p className="font-bold text-slate-900 dark:text-slate-100">
                      {event.application.applicant.firstName} {event.application.applicant.lastName}{' '}
                      <span className="font-normal text-slate-500">
                        moved to <strong className="text-emerald-600 dark:text-emerald-400">{event.toStatus}</strong>
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Job: {event.application.job.title} • By {event.changedBy.name} on{' '}
                      {new Date(event.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
