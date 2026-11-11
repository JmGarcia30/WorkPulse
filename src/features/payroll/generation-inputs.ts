import { CompensationType, PayFrequency, AttendanceStatus, AttendanceDisposition, Prisma } from '@prisma/client';

type Compensation = { id: string; compensationType: CompensationType; payFrequency: PayFrequency; currency: string; baseRate: string; overtimePayPerHour: string | null; undertimeDeductionPerHour: string | null; lateDeductionPerMinute: string | null; absenceDeductionPerDay: string | null };
type Attendance = { attendanceDate: string; attendanceStatus: AttendanceStatus; disposition: AttendanceDisposition; lateSeconds: number | null; undertimeSeconds: number | null; overtimeSeconds: number | null };
type LeaveDay = { attendanceDate: string; chargeUnits: string; leaveRequest: { id: string; leaveTypeId: string; leaveTypeCodeSnapshot: string; leaveTypeNameSnapshot: string; leavePaidSnapshot: boolean } };

// One statement/snapshot per employee, read immediately before calculating/writing that entry.
// Do not preload a whole organization: compensation/attendance/leave can change during generation.
export async function readPayrollGenerationInputs(
  db: Prisma.TransactionClient,
  organizationId: string,
  employeeId: string,
  periodStart: Date,
  periodEnd: Date
) {
  const [row] = await db.$queryRaw<Array<{ compensations: Compensation[]; attendance: Attendance[]; leaveDays: LeaveDay[] }>>(Prisma.sql`
    SELECT
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'compensationType', c."compensationType", 'payFrequency', c."payFrequency",
        'currency', c.currency, 'baseRate', c."baseRate"::text,
        'overtimePayPerHour', c."overtimePayPerHour"::text, 'undertimeDeductionPerHour', c."undertimeDeductionPerHour"::text,
        'lateDeductionPerMinute', c."lateDeductionPerMinute"::text, 'absenceDeductionPerDay', c."absenceDeductionPerDay"::text)
        ORDER BY c."effectiveFrom" DESC, c."createdAt" DESC)
        FROM "EmployeeCompensation" c WHERE c."organizationId" = ${organizationId}
          AND c."employeeId" = ${employeeId} AND c.status = 'ACTIVE'
          AND c."effectiveFrom" <= ${periodStart} AND (c."effectiveTo" IS NULL OR c."effectiveTo" >= ${periodEnd})
      ), '[]'::jsonb) AS compensations,
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'attendanceDate', d."attendanceDate"::text, 'attendanceStatus', d."attendanceStatus",
        'disposition', d.disposition, 'lateSeconds', d."lateSeconds", 'undertimeSeconds', d."undertimeSeconds", 'overtimeSeconds', d."overtimeSeconds")
        ORDER BY d."attendanceDate")
        FROM "DailyAttendanceRecord" d WHERE d."organizationId" = ${organizationId}
          AND d."employeeId" = ${employeeId} AND d."attendanceDate" BETWEEN ${periodStart} AND ${periodEnd}
      ), '[]'::jsonb) AS attendance,
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'attendanceDate', d."attendanceDate"::text, 'chargeUnits', d."chargeUnits"::text,
        'leaveRequest', jsonb_build_object('id', r.id, 'leaveTypeId', r."leaveTypeId",
          'leaveTypeCodeSnapshot', r."leaveTypeCodeSnapshot", 'leaveTypeNameSnapshot', r."leaveTypeNameSnapshot",
          'leavePaidSnapshot', r."leavePaidSnapshot")) ORDER BY d."attendanceDate")
        FROM "LeaveRequestDay" d JOIN "LeaveRequest" r ON r.id = d."leaveRequestId"
        WHERE d."organizationId" = ${organizationId} AND d."employeeId" = ${employeeId}
          AND d."attendanceDate" BETWEEN ${periodStart} AND ${periodEnd} AND r.status = 'APPROVED'
      ), '[]'::jsonb) AS "leaveDays"
  `);
  return {
    compensations: row.compensations.map(c => ({ ...c, baseRate: new Prisma.Decimal(c.baseRate), overtimePayPerHour: c.overtimePayPerHour === null ? null : new Prisma.Decimal(c.overtimePayPerHour), undertimeDeductionPerHour: c.undertimeDeductionPerHour === null ? null : new Prisma.Decimal(c.undertimeDeductionPerHour), lateDeductionPerMinute: c.lateDeductionPerMinute === null ? null : new Prisma.Decimal(c.lateDeductionPerMinute), absenceDeductionPerDay: c.absenceDeductionPerDay === null ? null : new Prisma.Decimal(c.absenceDeductionPerDay) })),
    attendance: row.attendance.map(d => ({ ...d, attendanceDate: new Date(d.attendanceDate + 'T00:00:00.000Z') })),
    leaveDays: row.leaveDays.map(d => ({ ...d, attendanceDate: new Date(d.attendanceDate + 'T00:00:00.000Z'), chargeUnits: new Prisma.Decimal(d.chargeUnits) })),
  };
}
