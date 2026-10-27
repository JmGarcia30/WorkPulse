import { getAnalytics } from '@/features/analytics/queries';
import { AnalyticsFilterError, type AnalyticsFilters } from '@/features/analytics/date-range';
import { getSession } from '@/lib/auth/session';
import { canViewAnalytics } from '@/lib/permissions/rbac';
import { prisma } from '@/lib/db/prisma';
import { fileResponse, pdfDocument } from '@/features/reports/export-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function fail(message: string, status: number) {
  return new Response(message, { status, headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export async function GET(request: Request) {
  const user = await getSession();
  if (!user || !canViewAnalytics(user)) return fail('Not authorized to export analytics.', 403);
  const params = new URL(request.url).searchParams;
  const keys = ['preset', 'from', 'to', 'category'] as const;
  const filters: AnalyticsFilters = {};
  for (const key of keys) {
    const value = params.get(key);
    if (value !== null) {
      if (value.length > 30) return fail('Invalid report filter.', 400);
      filters[key] = value;
    }
  }

  try {
    // Reuse the dashboard's tenant-scoped analytics read model and date validation.
    const [data, organization] = await Promise.all([
      getAnalytics(filters),
      prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { name: true } }),
    ]);
    const { range, workforce, attendance, leave, payroll, employment } = data;
    const pdf = await pdfDocument({
      title: 'HR Analytics Summary',
      organization: organization.name,
      period: range.from + ' to ' + range.to + ' | ' + data.timeZone + ' | Category: ' + range.category,
      sections: [
        { heading: 'Workforce', lines: [
          'Active: ' + workforce.active + ' | Inactive: ' + workforce.inactive + ' | Separated: ' + workforce.separated,
          'Teaching: ' + workforce.teaching + ' | Non-teaching: ' + workforce.nonTeaching,
          'Probationary: ' + workforce.probationary + ' | Regular: ' + workforce.regular,
          'New conversions in range: ' + workforce.conversions,
        ] },
        { heading: 'Attendance', lines: [
          'Recorded days: ' + attendance.recordedDays + ' | Present: ' + attendance.presentDays + ' | Absent: ' + attendance.absentDays,
          'Incomplete days: ' + attendance.incompleteDays + ' | Late occurrences: ' + attendance.lateOccurrences,
          'Attendance rate: ' + (attendance.rate === null ? 'N/A' : attendance.rate.toFixed(1) + '%'),
        ] },
        { heading: 'Leave', lines: [
          'Requests: ' + leave.requests + ' | Pending: ' + leave.pending + ' | Approved: ' + leave.approved,
          'Rejected: ' + leave.rejected + ' | Withdrawn: ' + leave.withdrawn + ' | Cancelled: ' + leave.cancelled,
          'Approved charge units: ' + leave.approvedUnits,
          ...leave.byType.map(item => item.name + ': ' + item.count),
        ] },
        { heading: 'Finalized Payroll', lines: [
          'Entries: ' + payroll.entries + ' | Finalized entries: ' + payroll.finalizedEntries,
          'Finalized periods: ' + payroll.finalizedPeriods,
          ...payroll.totals.map(item => item.currency + ': gross ' + item.gross + ' | deductions ' + item.deductions + ' | net ' + item.net),
          ...(payroll.unavailableCurrencyEntries ? ['Entries with unavailable currency: ' + payroll.unavailableCurrencyEntries] : []),
          ...(!payroll.totals.length ? ['No finalized monetary totals in this period.'] : []),
        ] },
        { heading: 'Probation and Employment Actions', lines: [
          'Active probation: ' + employment.activeProbationCases,
          'Teaching: ' + employment.teachingCases + ' | Non-teaching: ' + employment.nonTeachingCases,
          'Actions requiring attention: ' + employment.actionCount,
          ...employment.actions.map(item => item.employeeNumber + ' | ' + item.employeeName + ' | ' + item.status + ' | ' + item.date),
        ] },
        { heading: 'Notes', lines: [
          'This summary uses stored WorkPulse records and the same calculation rules as the HR Analytics dashboard.',
          'Workforce and probation counts reflect current status; historical date filters apply to events and conversions only.',
          'Monetary totals include finalized payroll only and keep different currencies separate.',
        ] },
      ],
    });
    return fileResponse(pdf, 'workpulse-analytics-' + range.from + '-to-' + range.to + '.pdf', 'pdf');
  } catch (error) {
    if (error instanceof AnalyticsFilterError) return fail(error.message, 400);
    return fail('Analytics report could not be generated.', 500);
  }
}
