import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RfidEnrollment } from '@/components/attendance/RfidEnrollment';
import { rfidHRContext } from '@/features/attendance/rfid-server';
import { prisma } from '@/lib/db/prisma';
import { requestWorkspacePath } from '@/lib/tenant/server';

export default async function RfidEnrollmentPage() {
  let context;
  try { context = await rfidHRContext(); } catch { redirect('/dashboard'); }
  const [apiBase, kioskPath, attendancePath, audits, organization] = await Promise.all([
    requestWorkspacePath('/api/attendance/rfid'), requestWorkspacePath('/attendance-kiosk'), requestWorkspacePath('/dashboard/attendance'),
    prisma.rfidAudit.findMany({ where: { organizationId: context.organizationId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 30, select: { id: true, action: true, createdAt: true, actor: { select: { name: true } }, employee: { select: { firstName: true, lastName: true } } } }),
    prisma.organization.findUniqueOrThrow({ where: { id: context.organizationId }, select: { timeZone: true } }),
  ]);
  return <div className="space-y-6"><header><Link href={attendancePath} className="text-sm text-[var(--tenant-primary)]">← Attendance</Link><p className="wp-eyebrow mt-5">Attendance</p><h1 className="wp-page-title mt-1">RFID Cards &amp; Kiosk</h1><p className="mt-2 text-sm text-[var(--wp-text-muted)]">Manage employee cards and authorize attendance devices for your workspace.</p></header><RfidEnrollment apiBase={apiBase} kioskPath={kioskPath} /><section className="wp-card p-5"><h2 className="wp-section-title">Recent RFID activity</h2><p className="mt-1 text-xs text-[var(--wp-text-muted)]">Latest 30 actions · {organization.timeZone}</p><ul className="mt-4 divide-y divide-[var(--wp-border)]">{audits.map(audit => <li key={audit.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><div><strong>{audit.action.replaceAll('_', ' ')}</strong>{audit.employee && <span> · {audit.employee.firstName} {audit.employee.lastName}</span>}<span className="block text-[var(--wp-text-muted)]">Authorized by {audit.actor.name}</span></div><time dateTime={audit.createdAt.toISOString()}>{new Intl.DateTimeFormat('en-PH', { timeZone: organization.timeZone, dateStyle: 'medium', timeStyle: 'medium' }).format(audit.createdAt)}</time></li>)}</ul>{!audits.length && <p className="mt-4 text-sm text-[var(--wp-text-muted)]">No RFID activity yet.</p>}</section></div>;
}
