import { AttendanceDisposition, EmploymentCategory } from '@prisma/client';
import { getSession } from '@/lib/auth/session';
import { canViewAttendance } from '@/lib/permissions/rbac';
import { prisma } from '@/lib/db/prisma';
import { getAttendancePeriod } from '@/features/attendance/queries';
import { csvDocument, fileResponse, MAX_CSV_ROWS, MAX_PDF_ROWS, pdfDocument } from '@/features/reports/export-utils';
import { attendanceDateForInstant } from '@/features/attendance/domain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const statuses = ['ALL', 'PRESENT', 'LATE', 'ABSENT', 'LEAVE', 'REST_DAY', 'NO_SCHEDULE', 'OPEN'] as const;
type ReportStatus = typeof statuses[number];
const errorResponse = (message: string, status: number) => new Response(message, {
  status,
  headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
});
const dateString = (date: Date | null, timeZone: string) => date
  ? new Intl.DateTimeFormat('en-PH', { timeZone, hour: '2-digit', minute: '2-digit', hour12: true }).format(date)
  : '';
const minutes = (seconds: number | null) => seconds == null ? '' : String(Math.round(seconds / 60));
const reportStatus = (row: { status: string; disposition: string; lateSeconds: number | null }) =>
  row.disposition === AttendanceDisposition.APPROVED_LEAVE ? 'LEAVE'
    : (row.lateSeconds ?? 0) > 0 ? 'LATE' : row.status;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !canViewAttendance(session)) return errorResponse('Not authorized to export attendance.', 403);
  const params = new URL(request.url).searchParams;
  const format = params.get('format') ?? 'csv';
  const status = params.get('status') ?? 'ALL';
  const employeeId = params.get('employeeId') || undefined;
  const department = params.get('department') || undefined;
  const category = params.get('category') || undefined;
  if (!['csv', 'pdf'].includes(format) || !statuses.includes(status as ReportStatus) ||
      (employeeId?.length ?? 0) > 128 || (department?.length ?? 0) > 150 ||
      (category && !Object.values(EmploymentCategory).includes(category as EmploymentCategory))) {
    return errorResponse('Invalid attendance report filters.', 400);
  }

  try {
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: session.organizationId }, select: { name: true, timeZone: true },
    });
    const currentMonth = attendanceDateForInstant(new Date(), organization.timeZone).slice(0, 7);
    const month = params.get('month') || currentMonth;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) < 2000 || Number(month.slice(0, 4)) > 2100) {
      return errorResponse('Invalid attendance month.', 400);
    }
    const from = month + '-01';
    const endDate = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0));
    const to = month + '-' + String(endDate.getUTCDate()).padStart(2, '0');
    const filters = {
      from, to, employeeId, department, category: category as EmploymentCategory | undefined,
    };

    // The selected employee must belong to this organization.
    if (employeeId && !await prisma.employee.findFirst({
      where: { id: employeeId, organizationId: session.organizationId }, select: { id: true },
    })) return errorResponse('Employee not found.', 404);

    // Refuse overly large queries before loading any rows into memory.
    const matches = await prisma.dailyAttendanceRecord.count({
      where: {
        organizationId: session.organizationId,
        attendanceDate: { gte: new Date(from + 'T00:00:00Z'), lte: new Date(to + 'T00:00:00Z') },
        employeeId,
        employmentRecord: { department, employmentCategory: filters.category },
      },
    });
    const max = format === 'pdf' ? MAX_PDF_ROWS : MAX_CSV_ROWS;
    if (matches > max) return errorResponse('Report contains too many records. Filter by employee or department.', 413);
    const records = (await getAttendancePeriod(session.organizationId, filters))
      .filter(row => status === 'ALL' || reportStatus(row) === status);
    const rows = records.map(record => [
      record.attendanceDate,
      record.employee.employeeNumber,
      record.employee.firstName + ' ' + record.employee.lastName,
      record.department ?? '',
      record.category ?? '',
      dateString(record.firstTimeIn, organization.timeZone),
      dateString(record.lastTimeOut, organization.timeZone),
      minutes(record.lateSeconds),
      minutes(record.undertimeSeconds),
      minutes(record.overtimeSeconds),
      reportStatus(record),
      record.disposition,
      record.corrected ? 'Yes' : 'No',
    ]);
    if (format === 'csv') {
      return fileResponse(csvDocument(
        ['Date', 'Employee Number', 'Employee', 'Department', 'Category', 'Time In', 'Time Out', 'Late Minutes', 'Undertime Minutes', 'Overtime Minutes', 'Status', 'Disposition', 'Corrected'],
        rows,
      ), 'workpulse-attendance-' + month + '.csv', 'csv');
    }
    const counts = new Map<string, number>();
    for (const record of records) counts.set(reportStatus(record), (counts.get(reportStatus(record)) ?? 0) + 1);
    const pdf = await pdfDocument({
      title: 'Attendance Report',
      organization: organization.name,
      period: from + ' to ' + to + ' | ' + organization.timeZone + ' | Filter: ' + status,
      sections: [
        { heading: 'Summary', lines: ['Records: ' + records.length, ...[...counts].map(([name, count]) => name + ': ' + count)] },
        { heading: 'Attendance entries', lines: rows.length ? rows.map(row => 
          row[0] + ' | ' + row[1] + ' | ' + row[2] + ' | ' + row[10] + ' | In ' + (row[5] || '-') + ' | Out ' + (row[6] || '-') + ' | Late ' + (row[7] || '0') + ' min') : ['No matching records.'] },
      ],
    });
    return fileResponse(pdf, 'workpulse-attendance-' + month + '.pdf', 'pdf');
  } catch {
    return errorResponse('Attendance report could not be generated.', 500);
  }
}
