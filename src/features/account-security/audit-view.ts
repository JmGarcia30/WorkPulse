import 'server-only';
import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { findPlatformAdministrator } from '@/features/platform-admin/service';

const labels: Record<string, string> = {
  PROFILE_UPDATED: 'Own profile name updated', PASSWORD_CHANGED: 'Own password changed', LOGIN_LOCKOUT: 'Five incorrect password attempts; temporary lockout',
  PASSWORD_RESET_REQUESTED: 'Password recovery requested', PASSWORD_RESET_COMPLETED: 'Password reset completed; sessions revoked',
  SECURITY_ALERT_CLAIMED: 'Security alert delivery claimed', SECURITY_ALERT_ACCEPTED: 'Security alert accepted by SMTP', SECURITY_ALERT_FAILED: 'Security alert delivery failed',
  DRAFT_JOB_DELETED: 'Unused recruitment draft deleted', JOB_CREATED: 'Job created', JOB_UPDATED: 'Job updated', JOB_PUBLISHED: 'Job published', JOB_CLOSED: 'Job closed',
ORGANIZATION_DETAILS_UPDATED: 'Organization details updated', CAREER_PORTAL_ENABLED: 'Career portal enabled', CAREER_PORTAL_DISABLED: 'Career portal disabled',
  ORGANIZATION_CREATED: 'Organization created', INVITATION_CREATED: 'Administrator invitation created', INVITATION_RESENT: 'Administrator invitation resent', INVITATION_ACTIVATED: 'Administrator invitation activated',
  INVITATION_ISSUED: 'Administrator invitation issued', INVITATION_DELIVERY_FAILED: 'Administrator invitation delivery failed', INVITATION_RESEND: 'Administrator invitation reissued', INVITATION_REVOKE: 'Administrator invitation revoked',
  ACCOUNT_CREATED: 'Employee account created', EMPLOYEE_LINKED: 'Employee account linked', INVITATION_SENT: 'Invitation sent', ACCOUNT_ACTIVATED: 'Account activated', ACCOUNT_DISABLED: 'Account disabled', ACCOUNT_ENABLED: 'Account enabled',
  ACTIVATED: 'Employee account activated', DISABLED: 'Employee account disabled', ENABLED: 'Employee account enabled', INVITATION_SEND_FAILED: 'Employee invitation delivery failed', LINK_REJECTED: 'Employee account link rejected',
};
export const safeIdentifier = (value: string | null) => value ? 'ref:' + createHash('sha256').update(value).digest('hex').slice(0, 16) : 'System / unauthenticated';
type Metadata = { id: string; createdAt: Date; organization: { name: string }; actor?: string | null; module: string; action: string; recordType: string; success: boolean };

/** Authorize independently; callers cannot substitute a tenant role or organization ID. */
export async function listSafePlatformAudits(db: PrismaClient, platformToken: string | undefined) {
  if (!await findPlatformAdministrator(db, platformToken)) throw new Error('FORBIDDEN');
  const organization = { select: { name: true } } as const;
  // Select only metadata at the SQL boundary. No raw JSON, amounts, documents or names/emails of tenant people.
  const [security, platform, accounts, attendance, payroll, branding, rfid, recruitment] = await Promise.all([
    db.accountSecurityEvent.findMany({ take: 100, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, createdAt: true, actorIdentifier: true, action: true, success: true, organization } }),
    db.platformOrganizationAudit.findMany({ take: 100, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, createdAt: true, actorAdministratorId: true, action: true, organization } }),
    db.employeeAccountAudit.findMany({ take: 100, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, createdAt: true, actorUserId: true, action: true, organization } }),
    db.attendanceCorrection.findMany({ take: 100, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, createdAt: true, createdById: true, organization } }),
    db.payrollPeriod.findMany({ where: { status: 'FINALIZED', finalizedAt: { not: null } }, take: 100, orderBy: [{ finalizedAt: 'desc' }, { id: 'desc' }], select: { id: true, finalizedAt: true, finalizedById: true, organization } }),
    db.organizationBrandingAudit.findMany({ take: 100, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, createdAt: true, actorUserId: true, organization } }),
    db.rfidAudit.findMany({ take: 100, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, createdAt: true, actorUserId: true, action: true, organization } }),
    db.applicationStatusHistory.findMany({ take: 100, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, createdAt: true, changedById: true, application: { select: { job: { select: { organization } } } } } }),
  ]);
  const metadata: Metadata[] = [
    ...security.map(r => ({ ...r, actor: r.actorIdentifier, module: r.action.startsWith('JOB_') || r.action === 'DRAFT_JOB_DELETED' ? 'Recruitment' : 'Account security', recordType: r.action.startsWith('JOB_') || r.action === 'DRAFT_JOB_DELETED' ? 'Job' : 'Account / security event' })),
    ...platform.map(r => ({ ...r, actor: r.actorAdministratorId, module: 'Platform administration', recordType: 'Organization / invitation', success: r.action !== 'INVITATION_DELIVERY_FAILED' })),
    ...accounts.map(r => ({ ...r, actor: r.actorUserId, module: 'Employee accounts', recordType: 'Employee account event', success: r.action !== 'INVITATION_SEND_FAILED' && r.action !== 'LINK_REJECTED' })),
    ...attendance.map(r => ({ ...r, actor: r.createdById, module: 'Attendance', action: 'ATTENDANCE_CORRECTED', recordType: 'Attendance correction', success: true })),
    ...payroll.map(r => ({ id: r.id, createdAt: r.finalizedAt!, organization: r.organization, actor: r.finalizedById, module: 'Payroll', action: 'PAYROLL_FINALIZED', recordType: 'Payroll period', success: true })),
    ...branding.map(r => ({ ...r, actor: r.actorUserId, module: 'Organization settings', action: 'SETTINGS_RECORDED', recordType: 'Organization settings event', success: true })),
    ...rfid.map(r => ({ ...r, actor: r.actorUserId, module: 'RFID', action: 'RFID_RECORDED', recordType: 'RFID event', success: ['CARD_REPLACED','CARD_ENROLLED','CARD_DEACTIVATED','KIOSK_AUTHORIZED','KIOSK_LOCKED','RECORDED'].includes(r.action) })),
    ...recruitment.map(r => ({ id: r.id, createdAt: r.createdAt, organization: r.application.job.organization, actor: r.changedById, module: 'Recruitment', action: 'APPLICATION_STATUS_RECORDED', recordType: 'Application status event', success: true })),
  ];
  return metadata.sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime() || a.module.localeCompare(b.module) || b.id.localeCompare(a.id)).slice(0,100).map(r => ({
    timestamp: r.createdAt.toISOString(), organization: r.organization.name, actor: safeIdentifier(r.actor ?? null), module: r.module,
    action: labels[r.action] ?? ({ ATTENDANCE_CORRECTED: 'Attendance corrected', PAYROLL_FINALIZED: 'Payroll finalized', SETTINGS_RECORDED: 'Settings event recorded', RFID_RECORDED: 'RFID event recorded', APPLICATION_STATUS_RECORDED: 'Application status changed' } as Record<string,string>)[r.action] ?? 'Recorded action',
    recordType: r.recordType, outcome: r.success ? 'Success' : 'Failure', description: 'Recorded metadata only. Sensitive record contents are excluded.', reference: safeIdentifier(r.id),
  }));
}
