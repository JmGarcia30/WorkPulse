import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';

type LeaveFact = { attendanceDate: Date; chargeUnits: Prisma.Decimal; leaveRequest: { id: string; leaveTypeId: string; leavePaidSnapshot: boolean } };
export function payrollLeaveEvidence(days: LeaveFact[]) {
  const facts = days.map(day => [day.attendanceDate.toISOString().slice(0, 10), day.chargeUnits.toFixed(4), day.leaveRequest.id, day.leaveRequest.leaveTypeId, day.leaveRequest.leavePaidSnapshot]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return 'leave-v1:' + createHash('sha256').update(JSON.stringify(facts)).digest('hex');
}
