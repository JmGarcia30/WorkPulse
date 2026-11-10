import 'server-only';
import { prisma } from '@/lib/db/prisma';
import { daysUntilJobDeadline, jobClosingDateString } from '@/features/hiring/job-deadline';
import { Role, JobStatus, LeaveRequestStatus } from '@prisma/client';

export type HrNotification = {
  key: string;
  category: 'application' | 'deadline' | 'leave' | 'payroll' | 'system';
  title: string;
  description: string;
  href: string;
  createdAt: string;
  read: boolean;
};
type Context = { organizationId: string; userId: string; role: Role };

export async function listHrNotifications(actor: Context, now: Date = new Date()): Promise<HrNotification[]> {
  if (actor.role !== Role.HR_ADMIN && actor.role !== Role.ORGANIZATION_ADMIN) return [];
  const since = new Date(now.getTime() - 14 * 86400000);
  const [organization, applications, leaves, jobs, payroll, closeEvents] = await Promise.all([
    prisma.organization.findUnique({ where: { id: actor.organizationId }, select: { timeZone: true } }),
    prisma.application.findMany({
      where: { job: { organizationId: actor.organizationId }, appliedAt: { gte: since } },
      select: { id: true, appliedAt: true, job: { select: { title: true } } },
      orderBy: { appliedAt: 'desc' }, take: 20,
    }),
    prisma.leaveRequest.findMany({
      where: { organizationId: actor.organizationId, status: LeaveRequestStatus.PENDING },
      select: { id: true, submittedAt: true }, orderBy: { submittedAt: 'desc' }, take: 20,
    }),
    prisma.job.findMany({
      where: { organizationId: actor.organizationId, status: JobStatus.PUBLISHED, closingDate: { not: null } },
      select: { id: true, title: true, closingDate: true }, orderBy: { closingDate: 'asc' }, take: 50,
    }),
    prisma.payrollPeriod.findMany({
      where: { organizationId: actor.organizationId, status: { not: 'FINALIZED' } },
      select: { id: true, name: true, payDate: true, updatedAt: true },
      orderBy: { payDate: 'asc' }, take: 15,
    }),
    prisma.accountSecurityEvent.findMany({
      where: { organizationId: actor.organizationId, action: 'JOB_AUTO_CLOSED', createdAt: { gte: since } },
      select: { id: true, createdAt: true, subjectIdentifier: true }, orderBy: { createdAt: 'desc' }, take: 20,
    }),
  ]);
  if (!organization) return [];
  const items: Omit<HrNotification, 'read'>[] = [];
  for (const app of applications) {
    items.push({ key: `application:${app.id}`, category: 'application', title: 'New job application',
      description: `An application was received for ${app.job.title}.`,
      href: '/dashboard/hiring/applicants', createdAt: app.appliedAt.toISOString() });
  }
  for (const leave of leaves) {
    items.push({ key: `leave:${leave.id}`, category: 'leave', title: 'Leave request pending',
      description: 'A leave request needs HR review.', href: '/dashboard/leave',
      createdAt: leave.submittedAt.toISOString() });
  }
  for (const job of jobs) {
    const days = daysUntilJobDeadline(job.closingDate, organization.timeZone, now);
    if (days === null || days > 3 || days < 0) continue;
    const date = jobClosingDateString(job.closingDate);
    items.push({ key: `deadline:${job.id}:${date}`, category: 'deadline',
      title: days === 0 ? 'Job closes today' : 'Job closing soon',
      description: `${job.title} closes in ${days === 0 ? 'the current day' : `${days} day${days === 1 ? '' : 's'}`}.`,
      href: `/dashboard/hiring/jobs/${job.id}`, createdAt: now.toISOString() });
  }
  for (const period of payroll) {
    const days = daysUntilJobDeadline(period.payDate, organization.timeZone, now);
    if (days === null || days < 0 || days > 3) continue;
    items.push({ key: `payroll:${period.id}:${period.payDate.toISOString().slice(0, 10)}`,
      category: 'payroll', title: 'Payroll needs review', description: `${period.name} is not finalized.`,
      href: '/dashboard/payroll', createdAt: period.updatedAt.toISOString() });
  }
  for (const event of closeEvents) {
    items.push({ key: `auto-closed:${event.id}`, category: 'system',
      title: 'Job automatically closed', description: 'A posting reached its closing deadline.',
      href: `/dashboard/hiring/jobs/${event.subjectIdentifier}`, createdAt: event.createdAt.toISOString() });
  }
  // Fetch only receipt keys for visible source records; old receipts cannot
  // crowd out current unread state as an organization grows.
  const readReceipts = items.length ? await prisma.hrNotificationRead.findMany({
    where: {
      organizationId: actor.organizationId,
      userId: actor.userId,
      notificationKey: { in: items.map(item => item.key) },
    },
    select: { notificationKey: true },
  }) : [];
  const readKeys = new Set(readReceipts.map(row => row.notificationKey));
  return items.map(item => ({ ...item, read: readKeys.has(item.key) }))
    .sort((a, b) => Number(a.read) - Number(b.read) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 80);
}
