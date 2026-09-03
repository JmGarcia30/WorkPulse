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
  Sparkles,
  Kanban,
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
    <div className="space-y-8">
      {/* Hero Welcome Banner (matching reference image dark hero card) */}
      <div className="relative overflow-hidden rounded-3xl bg-[#181A1C] p-7 sm:p-9 text-white shadow-md border border-[#2E3238]">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur-md border border-white/10 text-white">
              <Sparkles className="h-3.5 w-3.5 text-[#F97316]" />
              <span>AI-Powered Workforce Operations</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {user.name}!
            </h1>
            <p className="text-xs sm:text-sm text-[#9CA3AF] leading-relaxed">
              Track candidate pipelines, interview evaluations, and employee
              onboarding across your organization in real time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/hiring/jobs/new"
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-xs font-bold text-[#181A1C] hover:bg-slate-100 shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" />
              Post New Job
            </Link>

            <Link
              href="/dashboard/hiring/pipeline"
              className="inline-flex items-center gap-2 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/10 px-4 py-2.5 text-xs font-bold text-white backdrop-blur-md transition-all"
            >
              <Kanban className="h-4 w-4" />
              ATS Pipeline
            </Link>
          </div>
        </div>

        {/* Subtle Decorative Glow */}
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />
      </div>

      {/* KPI Stat Cards Grid (Pure White Cards with Dark Icon Badges) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {/* Active Openings */}
        <div className="group rounded-3xl border border-[#E8EAED] bg-white p-5 shadow-2xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
              Active Openings
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#181A1C] text-white group-hover:scale-105 transition-transform">
              <CheckCircle className="h-4 w-4 text-[#22C55E]" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold text-[#181A1C] tracking-tight">
              {publishedJobs}
            </p>
            <p className="text-[11px] text-[#16A34A] font-bold mt-1">
              {totalJobs} total positions created
            </p>
          </div>
        </div>

        {/* Total Applicants */}
        <div className="group rounded-3xl border border-[#E8EAED] bg-white p-5 shadow-2xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
              Candidate Pool
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#181A1C] text-white group-hover:scale-105 transition-transform">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold text-[#181A1C] tracking-tight">
              {totalApplications}
            </p>
            <p className="text-[11px] text-[#6B7280] font-bold mt-1">
              {awaitingReviewCount} awaiting initial review
            </p>
          </div>
        </div>

        {/* Active Assessments */}
        <div className="group rounded-3xl border border-[#E8EAED] bg-white p-5 shadow-2xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
              Assessments
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#181A1C] text-white group-hover:scale-105 transition-transform">
              <Award className="h-4 w-4 text-[#F97316]" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold text-[#181A1C] tracking-tight">
              {activeAssessmentsCount}
            </p>
            <p className="text-[11px] text-[#F97316] font-bold mt-1">
              {awaitingAssessmentReviewCount} submissions pending
            </p>
          </div>
        </div>

        {/* Active Offers */}
        <div className="group rounded-3xl border border-[#E8EAED] bg-white p-5 shadow-2xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
              Job Offers
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#181A1C] text-white group-hover:scale-105 transition-transform">
              <FileCheck className="h-4 w-4 text-[#22C55E]" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold text-[#181A1C] tracking-tight">
              {activeOffersCount}
            </p>
            <p className="text-[11px] text-[#6B7280] font-bold mt-1">
              {pendingOfferApprovalCount} pending approvals
            </p>
          </div>
        </div>

        {/* Onboarding */}
        <div className="group rounded-3xl border border-[#E8EAED] bg-white p-5 shadow-2xs hover:shadow-sm transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
              Onboarding
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#181A1C] text-white group-hover:scale-105 transition-transform">
              <UserCheck className="h-4 w-4 text-[#22C55E]" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-3xl font-extrabold text-[#181A1C] tracking-tight">
              {activeOnboardingCount}
            </p>
            <p className="text-[11px] text-[#16A34A] font-bold mt-1">
              {pendingOnboardingReviewCount} task reviews needed
            </p>
          </div>
        </div>
      </div>

      {/* Activity & Job Feed Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Job Openings */}
        <div className="rounded-3xl border border-[#E8EAED] bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E8EAED] pb-3">
            <h3 className="text-sm font-bold text-[#181A1C]">
              Job Postings
            </h3>
            <Link
              href="/dashboard/hiring/jobs"
              className="text-xs font-bold text-[#181A1C] hover:underline flex items-center gap-1"
            >
              View All <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {recentJobs.length === 0 ? (
              <p className="text-xs text-[#6B7280] text-center py-6">No jobs posted yet.</p>
            ) : (
              recentJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between rounded-2xl border border-[#E8EAED] bg-[#F8F9FA]/70 p-3.5"
                >
                  <div>
                    <Link
                      href={`/dashboard/hiring/jobs/${job.id}`}
                      className="text-xs font-bold text-[#181A1C] hover:underline block truncate"
                    >
                      {job.title}
                    </Link>
                    <div className="flex items-center gap-2 text-[11px] text-[#6B7280] mt-0.5">
                      <span>{job.department}</span>
                      <span>•</span>
                      <span>{job._count.applications} apps</span>
                    </div>
                  </div>

                  <span
                    className={`rounded-xl px-2.5 py-1 text-[10px] font-bold ${
                      job.status === JobStatus.PUBLISHED
                        ? 'bg-emerald-50 text-emerald-700'
                        : job.status === JobStatus.DRAFT
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-100 text-slate-600'
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
        <div className="rounded-3xl border border-[#E8EAED] bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E8EAED] pb-3">
            <h3 className="text-sm font-bold text-[#181A1C] flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#181A1C]" /> Upcoming Interviews
            </h3>
            <Link
              href="/dashboard/hiring/interviews"
              className="text-xs font-bold text-[#181A1C] hover:underline flex items-center gap-1"
            >
              All Interviews <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {upcomingInterviews.length === 0 ? (
              <p className="text-xs text-[#6B7280] text-center py-6">
                No upcoming interviews scheduled.
              </p>
            ) : (
              upcomingInterviews.map((iv) => (
                <div
                  key={iv.id}
                  className="rounded-2xl border border-[#E8EAED] bg-[#F8F9FA]/70 p-3.5 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <Link
                      href={`/dashboard/hiring/applicants/${iv.application.id}`}
                      className="text-xs font-bold text-[#181A1C] hover:underline"
                    >
                      {iv.application.applicant.firstName} {iv.application.applicant.lastName}
                    </Link>
                    <span className="rounded-xl bg-[#181A1C] px-2.5 py-0.5 text-[9px] font-bold text-white">
                      {iv.type.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6B7280] flex items-center gap-1">
                    <Clock className="h-3 w-3 text-[#9CA3AF]" />
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
        <div className="rounded-3xl border border-[#E8EAED] bg-white p-6 shadow-2xs">
          <div className="flex items-center justify-between border-b border-[#E8EAED] pb-3">
            <h3 className="text-sm font-bold text-[#181A1C] flex items-center gap-2">
              <History className="h-4 w-4 text-[#181A1C]" /> Recent Audit Activity
            </h3>
            <Link
              href="/dashboard/hiring/applicants"
              className="text-xs font-bold text-[#181A1C] hover:underline flex items-center gap-1"
            >
              All Applicants <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {statusHistoryEvents.length === 0 ? (
              <p className="text-xs text-[#6B7280] text-center py-6">
                No recent status modifications recorded.
              </p>
            ) : (
              statusHistoryEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 rounded-2xl border border-[#E8EAED] bg-[#F8F9FA]/70 p-3.5"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs shrink-0">
                    ✓
                  </div>
                  <div className="text-xs space-y-0.5">
                    <p className="font-bold text-[#181A1C]">
                      {event.application.applicant.firstName} {event.application.applicant.lastName}{' '}
                      <span className="font-normal text-[#6B7280]">
                        moved to <strong className="text-[#16A34A]">{event.toStatus}</strong>
                      </span>
                    </p>
                    <p className="text-[11px] text-[#6B7280]">
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
