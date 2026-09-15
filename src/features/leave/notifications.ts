import { LeaveRequestAuditAction } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { sendEmail } from '@/lib/email';
import type { Prisma } from '@prisma/client';

export type LeaveNotificationEvent = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
type Sender = typeof sendEmail;

const labels: Record<LeaveNotificationEvent, string> = {
  SUBMITTED: 'submitted', APPROVED: 'approved', REJECTED: 'rejected', CANCELLED: 'cancelled',
};
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);

/** Runs only after the authoritative leave transaction. Delivery failure is audited and never rethrown. */
export async function notifyLeaveEmployee(requestId: string, actorUserId: string, event: LeaveNotificationEvent, sender: Sender = sendEmail, database: typeof prisma | Prisma.TransactionClient = prisma) {
  const request = await database.leaveRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true, organizationId: true, leaveTypeNameSnapshot: true,
      employee: { select: { firstName: true, employeeAccount: { select: { user: { select: { email: true } } } } } },
    },
  });
  if (!request) return;
  const email = request.employee.employeeAccount?.user.email;
  let success = false;
  let deliveryId: string | null = null;
  let mode: string | null = null;
  if (email) {
    try {
      const result = await sender({
        to: email,
        subject: `Leave request ${labels[event]} — ${request.leaveTypeNameSnapshot}`,
        text: `Hello ${request.employee.firstName}, your ${request.leaveTypeNameSnapshot} request has been ${labels[event]}. Sign in to WorkPulse to view its current status.`,
        html: `<p>Hello ${escapeHtml(request.employee.firstName)},</p><p>Your ${escapeHtml(request.leaveTypeNameSnapshot)} request has been <strong>${labels[event]}</strong>.</p><p>Sign in to WorkPulse to view its current status.</p>`,
        sensitive: true,
      });
      success = result.success;
      deliveryId = result.id;
      mode = result.mode;
    } catch { success = false; }
  }
  await database.leaveRequestAudit.create({ data: {
    organizationId: request.organizationId, leaveRequestId: request.id, actorUserId,
    action: success ? LeaveRequestAuditAction.NOTIFICATION_SENT : LeaveRequestAuditAction.NOTIFICATION_FAILED,
    details: { event, deliveryId, mode, recipientAvailable: Boolean(email) },
  } }).catch(() => undefined);
}
