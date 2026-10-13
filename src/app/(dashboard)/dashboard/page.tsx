import { MetricStrip, WorkspacePanel } from '@/components/ui/Workspace';
import Link from 'next/link';
import { ApplicationStatus, AssessmentStatus, AttendanceStatus, EmployeeStatus, LeaveRequestStatus, OfferStatus, OnboardingTaskStatus, ProbationStatus } from '@prisma/client';
import { ArrowRight, Banknote, CalendarCheck, ClipboardList, Clock3, FileUser, UserPlus, Users } from 'lucide-react';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { canViewEmployees, canViewPayroll } from '@/lib/permissions/rbac';
import { prisma } from '@/lib/db/prisma';
import { getOrganizationBranding } from '@/features/organization-branding/read-model';
import { attendanceDateForInstant } from '@/features/attendance/domain';
import { formatStatusLabel } from '@/lib/ui/format-status';

type AttentionItem = { label: string; href: string };

export default async function DashboardPage() {
  const user = await requireBackOfficeContext();
  const branding = await getOrganizationBranding(user.organizationId);
  if (!branding) return null;
  const organizationId = user.organizationId;
  const hasHrAccess = canViewEmployees(user);
  const hasPayrollAccess = canViewPayroll(user);
  const today = attendanceDateForInstant(new Date(), branding.timeZone);
  const todayDate = new Date(`${today}T00:00:00.000Z`);
  const reviewThrough = new Date();
  reviewThrough.setUTCDate(reviewThrough.getUTCDate() + 30);

  const [activeEmployees, pendingApplicants, pendingLeave, presentToday, latestPayroll, probationDue, missingCompensation, incompleteEmployeeSetup, submittedAssessments, pendingOffers, pendingOnboardingReviews, hiringStages] = await Promise.all([
    hasHrAccess ? prisma.employee.count({ where: { organizationId, employeeStatus: EmployeeStatus.ACTIVE } }) : Promise.resolve(0),
    prisma.application.count({ where: { job: { organizationId }, status: ApplicationStatus.APPLIED } }),
    hasHrAccess ? prisma.leaveRequest.count({ where: { organizationId, status: LeaveRequestStatus.PENDING } }) : Promise.resolve(0),
    hasHrAccess ? prisma.dailyAttendanceRecord.count({ where: { organizationId, attendanceDate: todayDate, attendanceStatus: AttendanceStatus.PRESENT } }) : Promise.resolve(0),
    hasPayrollAccess ? prisma.payrollPeriod.findFirst({ where: { organizationId }, orderBy: [{ payDate: 'desc' }, { createdAt: 'desc' }], select: { id: true, name: true, status: true } }) : Promise.resolve(null),
    hasHrAccess ? prisma.probationRecord.count({ where: { probationStatus: ProbationStatus.ACTIVE, expectedEndAt: { lte: reviewThrough }, employee: { organizationId } } }) : Promise.resolve(0),
    hasPayrollAccess ? prisma.employee.count({ where: { organizationId, employeeStatus: EmployeeStatus.ACTIVE, employeeCompensations: { none: { status: 'ACTIVE' } } } }) : Promise.resolve(0),
    hasHrAccess ? prisma.employee.count({ where: { organizationId, employeeStatus: EmployeeStatus.ACTIVE, OR: [{ employmentRecords: { none: {} } }, { employeeAccount: { is: null } }] } }) : Promise.resolve(0),
    prisma.assessment.count({ where: { application: { job: { organizationId } }, status: AssessmentStatus.SUBMITTED } }),
    prisma.offer.count({ where: { application: { job: { organizationId } }, status: OfferStatus.PENDING_APPROVAL } }),
    prisma.onboardingTask.count({ where: { onboardingProcess: { application: { job: { organizationId } } }, status: OnboardingTaskStatus.SUBMITTED } }),
    prisma.application.groupBy({ by: ['status'], where: { job: { organizationId } }, _count: { _all: true } }),
  ]);

  const hiringActions = submittedAssessments + pendingOffers + pendingOnboardingReviews;
  const attention: AttentionItem[] = [];
  if (pendingLeave > 0) attention.push({ label: `${pendingLeave} leave request${pendingLeave === 1 ? '' : 's'} need review`, href: '/dashboard/leave' });
  if (probationDue > 0) attention.push({ label: `${probationDue} probation review${probationDue === 1 ? '' : 's'} are due soon`, href: '/dashboard/employees?needsReview=1' });
  if (missingCompensation > 0) attention.push({ label: `Compensation setup is missing for ${missingCompensation} employee${missingCompensation === 1 ? '' : 's'}`, href: '/dashboard/payroll' });
  if (incompleteEmployeeSetup > 0) attention.push({ label: `${incompleteEmployeeSetup} employee record${incompleteEmployeeSetup === 1 ? '' : 's'} need setup`, href: '/dashboard/employees' });
  if (hiringActions > 0) attention.push({ label: `${hiringActions} hiring action${hiringActions === 1 ? '' : 's'} are waiting`, href: '/dashboard/hiring/applicants' });
  if (hasPayrollAccess && !latestPayroll) attention.push({ label: 'Payroll setup has not started', href: '/dashboard/payroll' });

  const greetingHour = Number(new Intl.DateTimeFormat('en-PH', { hour: 'numeric', hourCycle: 'h23', timeZone: branding.timeZone }).format(new Date()));
  const greeting = greetingHour < 12 ? 'Good morning' : greetingHour < 18 ? 'Good afternoon' : 'Good evening';
  const quickActions = hasHrAccess ? [
    { label: 'Employee Records', href: '/dashboard/employees', icon: UserPlus },
    { label: 'View Applicants', href: '/dashboard/hiring/applicants', icon: FileUser },
    { label: 'Review Leave', href: '/dashboard/leave', icon: ClipboardList },
    { label: 'Attendance', href: '/dashboard/attendance', icon: Clock3 },
    ...(hasPayrollAccess ? [{ label: 'Payroll', href: '/dashboard/payroll', icon: Banknote }] : []),
  ] : [
    { label: 'Hiring Pipeline', href: '/dashboard/hiring/pipeline', icon: FileUser },
    { label: 'View Applicants', href: '/dashboard/hiring/applicants', icon: Users },
    { label: 'Interviews', href: '/dashboard/hiring/interviews', icon: CalendarCheck },
  ];
  const summaries = hasHrAccess ? [
    { label: 'Active Employees', value: String(activeEmployees), helper: 'Current active records', href: '/dashboard/employees' },
    { label: 'Pending Applicants', value: String(pendingApplicants), helper: 'Awaiting initial review', href: '/dashboard/hiring/applicants' },
    { label: 'Leave Requests', value: String(pendingLeave), helper: 'Waiting for a decision', href: '/dashboard/leave' },
    { label: 'Attendance Today', value: String(presentToday), helper: `Present of ${activeEmployees} active employees`, href: '/dashboard/attendance' },
  ] : [
    { label: 'Pending Applicants', value: String(pendingApplicants), helper: 'Awaiting initial review', href: '/dashboard/hiring/applicants' },
    { label: 'Hiring Actions', value: String(hiringActions), helper: 'Waiting for review', href: '/dashboard/hiring/applicants' },
  ];

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="wp-eyebrow">{branding.displayName} / HR workspace</p><h1 className="wp-page-title mt-1">{greeting}, {user.name.split(' ')[0]}</h1><p className="mt-2 text-sm text-[var(--wp-text-muted)]">Your workforce, hiring progress, and outstanding reviews in one place.</p></div>
      <p className="text-sm text-[var(--wp-text-muted)]">{new Intl.DateTimeFormat('en-PH', { dateStyle: 'full', timeZone: branding.timeZone }).format(new Date())}</p>
    </header>
    <section aria-label="Workforce summary"><MetricStrip items={summaries} /></section>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="space-y-5">
        <WorkspacePanel title="Needs attention" description="Outstanding reviews and setup tasks from current records.">
          {attention.length === 0 ? <p className="rounded-md bg-[var(--wp-surface-subtle)] p-4 text-sm text-[var(--wp-text-muted)]">No outstanding items in the tracked queues.</p> : <div>{attention.map(item => <Link key={item.label} href={item.href} className="wp-queue-row"><span>{item.label}</span><ArrowRight className="h-4 w-4 shrink-0 text-[var(--tenant-primary)]" aria-hidden="true" /></Link>)}</div>}
        </WorkspacePanel>
        <WorkspacePanel title="Hiring overview" description="Application counts across your organization's hiring stages." href="/dashboard/hiring/pipeline">
          {hiringStages.length === 0 ? <p className="text-sm text-[var(--wp-text-muted)]">No applications received yet.</p> : <div className="grid grid-cols-2 gap-x-5 sm:grid-cols-3">{hiringStages.map(stage => <Link key={stage.status} href={`/dashboard/hiring/applicants?status=${stage.status}`} className="flex items-center justify-between gap-3 border-b py-3 text-sm"><span className="text-[var(--wp-text-muted)]">{formatStatusLabel(stage.status)}</span><span className="font-semibold tabular-nums">{stage._count._all}</span></Link>)}</div>}
          <div className="mt-4 divide-y border-t">
            {[{ label: 'Submitted assessments', count: submittedAssessments, href: '/dashboard/hiring/assessments' }, { label: 'Offers awaiting approval', count: pendingOffers, href: '/dashboard/hiring/offers' }, { label: 'Onboarding submissions to verify', count: pendingOnboardingReviews, href: '/dashboard/hiring/onboarding' }].map(item => <Link key={item.href} href={item.href} className="wp-queue-row"><span>{item.label}</span><span className="font-semibold tabular-nums">{item.count}</span></Link>)}
          </div>
        </WorkspacePanel>
      </div>
      <div className="space-y-5">
        {hasHrAccess && <WorkspacePanel title="Workforce operations" description="Today's attendance and upcoming employee reviews.">
          <Link href="/dashboard/attendance" className="wp-queue-row"><span>Present today <span className="block text-sm text-[var(--wp-text-muted)]">Recorded present attendance / active employees</span></span><span className="whitespace-nowrap font-semibold tabular-nums">{presentToday} / {activeEmployees}</span></Link>
          <Link href="/dashboard/leave" className="wp-queue-row"><span>Leave approvals</span><span className="font-semibold tabular-nums">{pendingLeave}</span></Link>
          <Link href="/dashboard/employees?needsReview=1" className="wp-queue-row"><span>Probation reviews <span className="block text-sm text-[var(--wp-text-muted)]">Overdue or ending within 30 days</span></span><span className="font-semibold tabular-nums">{probationDue}</span></Link>
        </WorkspacePanel>}
        {hasPayrollAccess && <WorkspacePanel title="Payroll readiness" href="/dashboard/payroll">
          <div className="rounded-md bg-[var(--wp-surface-subtle)] p-3"><p className="text-sm font-semibold">{latestPayroll?.name ?? 'No payroll period yet'}</p><p className="mt-1 text-sm text-[var(--wp-text-muted)]">{latestPayroll ? formatStatusLabel(latestPayroll.status) : 'Create a period to begin payroll preparation.'}</p></div>
          <Link href="/dashboard/payroll" className="wp-queue-row"><span>Missing active compensation</span><span className="font-semibold tabular-nums">{missingCompensation}</span></Link>
          <p className="text-sm text-[var(--wp-text-muted)]">Open payroll to review period validation and readiness.</p>
        </WorkspacePanel>}
        <WorkspacePanel title="Quick actions"><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">{quickActions.map(({ label, href, icon: Icon }) => <Link key={href} href={href} className="wp-button-secondary justify-start"><Icon className="h-4 w-4 text-[var(--tenant-primary)]" aria-hidden="true" />{label}</Link>)}</div></WorkspacePanel>
      </div>
    </div>
  </div>;
}
