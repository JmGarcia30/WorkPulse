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

  const [activeEmployees, pendingApplicants, pendingLeave, presentToday, latestPayroll, probationDue, missingCompensation, incompleteEmployeeSetup, submittedAssessments, pendingOffers, pendingOnboardingReviews] = await Promise.all([
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
    ...(hasPayrollAccess ? [{ label: 'Payroll Status', value: latestPayroll ? formatStatusLabel(latestPayroll.status) : 'Not Started', helper: latestPayroll?.name ?? 'No payroll period yet', href: latestPayroll ? `/dashboard/payroll?period=${latestPayroll.id}` : '/dashboard/payroll' }] : []),
  ] : [
    { label: 'Pending Applicants', value: String(pendingApplicants), helper: 'Awaiting initial review', href: '/dashboard/hiring/applicants' },
    { label: 'Hiring Actions', value: String(hiringActions), helper: 'Waiting for review', href: '/dashboard/hiring/applicants' },
  ];

  return <div className="space-y-8">
    <header className="space-y-2"><p className="wp-eyebrow">{branding.displayName}</p><h1 className="wp-page-title">{greeting}, {user.name.split(' ')[0]}</h1><p className="max-w-2xl text-sm leading-6 text-[var(--wp-text-muted)]">Here is what needs your attention across your organization today.</p></header>
    <section aria-labelledby="quick-actions-title"><div className="mb-3"><h2 id="quick-actions-title" className="wp-section-title">Quick actions</h2><p className="mt-1 text-sm text-[var(--wp-text-muted)]">Go directly to the tasks you use most.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{quickActions.map(({ label, href, icon: Icon }, index) => <Link key={href} href={href} className={`${index === 0 ? 'bg-[var(--tenant-primary)] text-[var(--tenant-primary-foreground)]' : 'border border-[var(--tenant-border)] bg-white text-[var(--wp-text)]'} group flex min-h-20 items-center gap-3 rounded-2xl px-4 py-4 font-bold transition hover:-translate-y-0.5 hover:shadow-sm`}><span className={`${index === 0 ? 'bg-white/15' : 'bg-[var(--tenant-tint-strong)] text-[var(--tenant-primary)]'} flex h-10 w-10 shrink-0 items-center justify-center rounded-xl`}><Icon className="h-5 w-5" aria-hidden="true" /></span><span>{label}</span></Link>)}</div></section>
    <section aria-labelledby="summary-title"><h2 id="summary-title" className="wp-section-title">At a glance</h2><div className={`mt-3 grid gap-px overflow-hidden rounded-2xl border border-[var(--tenant-border)] bg-[var(--tenant-border)] sm:grid-cols-2 ${summaries.length >= 5 ? 'xl:grid-cols-5' : 'lg:grid-cols-3'}`}>{summaries.map(item => <Link key={item.label} href={item.href} className="min-h-28 bg-white p-5 transition hover:bg-[var(--tenant-tint)]"><p className="text-sm font-semibold text-[var(--wp-text-muted)]">{item.label}</p><p className="mt-2 text-2xl font-bold tracking-tight text-[var(--wp-text)]">{item.value}</p><p className="mt-1 text-xs leading-5 text-[var(--wp-text-muted)]">{item.helper}</p></Link>)}</div></section>
    <section aria-labelledby="attention-title" className="rounded-2xl bg-white p-5 shadow-sm sm:p-6"><div><h2 id="attention-title" className="wp-section-title">Needs attention</h2><p className="mt-1 text-sm text-[var(--wp-text-muted)]">Real tasks that may need action from your team.</p></div>{attention.length === 0 ? <div className="mt-5 rounded-xl bg-[var(--tenant-tint)] px-4 py-5 text-sm text-[var(--wp-text-muted)]">Nothing needs immediate attention.</div> : <ul className="mt-4 divide-y divide-[var(--tenant-border)]">{attention.map(item => <li key={item.label}><Link href={item.href} className="group flex min-h-14 items-center justify-between gap-4 py-3 text-sm font-semibold"><span>{item.label}</span><span className="flex items-center gap-1 text-xs font-bold text-[var(--tenant-primary)]">Review <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" /></span></Link></li>)}</ul>}</section>
  </div>;
}
