import { createHash } from 'node:crypto';
import { AttendanceDisposition, AttendanceStatus } from '@prisma/client';

export type PayrollAttendanceFact = {
  attendanceDate: Date;
  attendanceStatus: AttendanceStatus;
  disposition: AttendanceDisposition;
  lateSeconds: number | null;
  undertimeSeconds: number | null;
};

/** Financial attendance policies require a complete, resolved period. */
export function attendanceReadinessIssue(days: PayrollAttendanceFact[], expectedDays: number): string | null {
  if (days.length !== expectedDays) return `Attendance must be materialized for all ${expectedDays} calendar days before this payroll policy can be calculated.`;
  const missing = days.filter(day => day.attendanceStatus === AttendanceStatus.NO_SCHEDULE).length;
  if (missing) return `Work schedule is missing for ${missing} attendance day(s). Assign the schedule and evaluate attendance before payroll.`;
  const unresolved = days.filter(day => day.attendanceStatus === AttendanceStatus.OPEN || day.attendanceStatus === AttendanceStatus.INCOMPLETE);
  if (unresolved.length) return `Attendance is unresolved for ${unresolved.length} day(s) (OPEN/INCOMPLETE). Complete or review attendance before payroll.`;
  return null;
}

/** Hash only calculation inputs, not recalculation timestamps or display data. */
export function payrollAttendanceEvidence(days: PayrollAttendanceFact[]): string {
  const facts = [...days].sort((a, b) => a.attendanceDate.getTime() - b.attendanceDate.getTime()).map(day => [
    day.attendanceDate.toISOString().slice(0, 10), day.attendanceStatus, day.disposition, day.lateSeconds, day.undertimeSeconds,
  ]);
  return 'attendance-v1:' + createHash('sha256').update(JSON.stringify(facts)).digest('hex');
}
