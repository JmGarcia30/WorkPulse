import { Prisma, PrismaClient, Role, type EmploymentCategory, type EmployeeStatus, type EmploymentStatus, type LeaveRequestStatus, type PayrollPeriodStatus, type PayrollEntryStatus } from '@prisma/client';
import { readAnalytics, AnalyticsAccessError } from '../src/features/analytics/read-model';
import { AnalyticsFilterError, resolveAnalyticsRange, type AnalyticsFilters } from '../src/features/analytics/date-range';
import { canViewAnalytics } from '../src/lib/permissions/rbac';
import type { UserSessionPayload } from '../src/lib/auth/session';

const prisma = new PrismaClient({ log: ['error'] });
const rollback = new Error('H8_ROLLBACK');
const marker = `h8-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const asOf = new Date('2026-10-11T04:00:00Z');
const day = (value: string) => new Date(`${value}T00:00:00Z`);
let assertions = 0;
function ok(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`FAIL: ${message}`);
  console.log(`PASS ${++assertions}: ${message}`);
}
async function denied(operation: () => Promise<unknown>) {
  try { await operation(); return false; } catch (error) { return error instanceof AnalyticsAccessError; }
}

async function main() {
  const thisMonth = resolveAnalyticsRange({}, 'Asia/Manila', new Date('2026-09-30T17:00:00Z'));
  ok(thisMonth.from === '2026-10-01' && thisMonth.to === '2026-10-31', 'default month follows tenant timezone at UTC month boundary');
  const lastMonth = resolveAnalyticsRange({ preset: 'last-month' }, 'Asia/Manila', asOf);
  ok(lastMonth.from === '2026-09-01' && lastMonth.to === '2026-09-30', 'Last Month resolves exact calendar bounds');
  const january = resolveAnalyticsRange({ preset: 'last-month' }, 'UTC', day('2026-01-12'));
  ok(january.from === '2025-12-01' && january.to === '2025-12-31', 'Last Month handles year rollover');
  const dst = resolveAnalyticsRange({ preset: 'custom', from: '2026-03-08', to: '2026-03-08' }, 'America/New_York');
  ok(dst.throughInstant.getTime() - dst.fromInstant.getTime() === 23 * 3600000, 'local date boundaries preserve daylight-saving transitions');
  for (const filters of [
    { preset: 'custom', from: '2026-02-30', to: '2026-03-01' },
    { preset: 'custom', from: '2026-10-12', to: '2026-10-01' },
    { preset: 'custom', from: '2025-01-01', to: '2026-10-01' },
    { preset: 'custom' }, { category: 'FAKE' }, { preset: 'FAKE' },
  ]) {
    let rejected = false;
    try { resolveAnalyticsRange(filters, 'UTC', asOf); } catch (error) { rejected = error instanceof AnalyticsFilterError; }
    ok(rejected, `invalid filters rejected: ${JSON.stringify(filters)}`);
  }

  try {
    await prisma.$transaction(async tx => {
      async function tenant(suffix: string) {
        const organization = await tx.organization.create({ data: { name: `H8 ${suffix}`, slug: `${marker}-${suffix}`, timeZone: 'Asia/Manila' } });
        const hr = await tx.user.create({ data: { organizationId: organization.id, name: `HR ${suffix}`, email: `${marker}-${suffix}@test.invalid`, role: Role.HR_ADMIN } });
        return { organization, hr };
      }
      const a = await tenant('a');
      const b = await tenant('b');
      const emptyTenant = await tenant('empty');
      const session = (user: { id: string; name: string; email: string; role: Role; organizationId: string }): UserSessionPayload => ({ userId: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organizationId });
      const admin = await tx.user.create({ data: { organizationId: a.organization.id, name: 'Admin A', email: `${marker}-admin@test.invalid`, role: Role.ORGANIZATION_ADMIN } });
      const manager = await tx.user.create({ data: { organizationId: a.organization.id, name: 'Manager A', email: `${marker}-manager@test.invalid`, role: Role.HIRING_MANAGER } });
      const employeeUser = await tx.user.create({ data: { organizationId: a.organization.id, name: 'Employee A', email: `${marker}-employee@test.invalid`, role: Role.EMPLOYEE } });

      async function employee(tenantData: typeof a, suffix: string, category: EmploymentCategory, status: EmployeeStatus = 'ACTIVE', employmentStatus: EmploymentStatus = 'PROBATIONARY', probationEnd?: string) {
        const job = await tx.job.create({ data: { organizationId: tenantData.organization.id, title: suffix, slug: `${marker}-${suffix}`, department: category === 'TEACHING' ? 'Academics' : 'Administration', employmentType: 'Full-Time', location: 'Test', description: 'H8 fixture', responsibilities: 'Test', qualifications: 'Test', requirements: 'Test', category } });
        const applicant = await tx.applicant.create({ data: { firstName: suffix, lastName: 'H8', email: `${marker}-${suffix}@employee.invalid`, phone: '0' } });
        const application = await tx.application.create({ data: { jobId: job.id, applicantId: applicant.id, status: 'HIRED', coverLetter: 'H8 fixture' } });
        let record = await tx.employee.create({ data: { organizationId: tenantData.organization.id, sourceApplicationId: application.id, applicantId: applicant.id, employeeNumber: `H8-${suffix}`, firstName: suffix, lastName: 'H8', email: applicant.email, phone: '0', createdById: tenantData.hr.id, employeeStatus: 'ACTIVE', createdAt: day('2026-09-01') } });
        const employment = await tx.employmentRecord.create({ data: {
          employeeId: record.id, jobId: job.id, jobTitle: suffix, department: job.department, employmentCategory: category, employmentType: 'Full-Time', employmentStatus,
          hireDate: day('2026-01-01'), startDate: day('2026-01-01'), effectiveFrom: day('2026-01-01'), salary: 999999, payFrequency: 'MONTHLY', createdById: tenantData.hr.id,
          ...(probationEnd ? { probation: { create: { employeeId: record.id, category, startedAt: day('2026-01-01'), expectedEndAt: day(probationEnd), maxRenewals: category === 'TEACHING' ? 2 : 0, policySnapshot: 'H2 test terms' } } } : {}),
        } });
        // H10 forbids new employment/attendance INSERTs after separation. Build
        // the historical day first; later ranking checks reuse it without mutation.
        const historicalAttendance = status === 'SEPARATED' ? await tx.dailyAttendanceRecord.create({ data: {
          organizationId: tenantData.organization.id, employeeId: record.id, employmentRecordId: employment.id,
          attendanceDate: day('2026-10-23'), timeZoneSnapshot: 'Asia/Manila', attendanceStatus: 'PRESENT', lateSeconds: 60, finalizedAt: asOf, lastCalculatedAt: asOf,
        } }) : null;
        if (status !== 'ACTIVE') record = await tx.employee.update({ where: { id: record.id }, data: { employeeStatus: status } });
        return { employee: record, employment, historicalAttendance };
      }
      const teaching = await employee(a, 'a-teaching', 'TEACHING', 'ACTIVE', 'PROBATIONARY', '2026-10-20');
      const regular = await employee(a, 'a-regular', 'NON_TEACHING', 'ACTIVE', 'REGULAR');
      const nonTeaching = await employee(a, 'a-probation', 'NON_TEACHING', 'ACTIVE', 'PROBATIONARY', '2026-10-05');
      const inactive = await employee(a, 'a-inactive', 'TEACHING', 'INACTIVE', 'PROBATIONARY', '2026-10-15');
      const separated = await employee(a, 'a-separated', 'NON_TEACHING', 'SEPARATED', 'REGULAR');
      const missingEmployment = await employee(a, 'a-no-current', 'NON_TEACHING');
      await tx.employmentRecord.update({ where: { id: missingEmployment.employment.id }, data: { effectiveTo: day('2026-09-30') } });
      await tx.employee.update({ where: { id: teaching.employee.id }, data: { createdAt: new Date('2026-09-30T17:00:00Z') } });
      await tx.employmentRecord.update({ where: { id: regular.employment.id }, data: { effectiveFrom: day('2026-06-01'), effectiveTo: day('2027-01-01') } });
      await tx.employmentRecord.create({ data: {
        employeeId: regular.employee.id, jobTitle: 'Old teaching position', department: 'Academics', employmentCategory: 'TEACHING', employmentType: 'Full-Time', employmentStatus: 'PROBATIONARY', hireDate: day('2025-01-01'), startDate: day('2025-01-01'), effectiveFrom: day('2025-01-01'), effectiveTo: day('2026-06-01'), salary: 999999, payFrequency: 'MONTHLY', createdById: a.hr.id,
        probation: { create: { employeeId: regular.employee.id, category: 'TEACHING', startedAt: day('2025-01-01'), expectedEndAt: day('2026-05-31'), probationStatus: 'CLOSED', decision: 'REGULARIZED', completedAt: day('2026-06-01'), decisionAt: day('2026-06-01'), decisionById: a.hr.id, maxRenewals: 2, policySnapshot: 'Historical closed case' } },
      } });
      await tx.employmentRecord.create({ data: {
        employeeId: regular.employee.id, jobTitle: 'Future teaching position', department: 'Academics', employmentCategory: 'TEACHING', employmentType: 'Full-Time', employmentStatus: 'PROBATIONARY', hireDate: day('2027-01-01'), startDate: day('2027-01-01'), effectiveFrom: day('2027-01-01'), salary: 999999, payFrequency: 'MONTHLY', createdById: a.hr.id,
        probation: { create: { employeeId: regular.employee.id, category: 'TEACHING', startedAt: day('2027-01-01'), expectedEndAt: day('2027-12-31'), maxRenewals: 2, policySnapshot: 'Future case' } },
      } });
      const privateEmployee = await employee(b, 'b-private', 'TEACHING', 'ACTIVE', 'PROBATIONARY', '2026-10-12');

      const attendanceInput = { organizationId: a.organization.id, employeeId: teaching.employee.id, employmentRecordId: teaching.employment.id, timeZoneSnapshot: 'Asia/Manila', lastCalculatedAt: asOf, finalizedAt: asOf };
      await tx.dailyAttendanceRecord.createMany({ data: [
        { ...attendanceInput, attendanceDate: day('2026-10-01'), attendanceStatus: 'PRESENT', lateSeconds: 120 },
        { ...attendanceInput, attendanceDate: day('2026-10-02'), attendanceStatus: 'PRESENT', lateSeconds: 60 },
        { ...attendanceInput, attendanceDate: day('2026-10-03'), attendanceStatus: 'ABSENT' },
        { ...attendanceInput, attendanceDate: day('2026-10-04'), attendanceStatus: 'INCOMPLETE' },
        { ...attendanceInput, attendanceDate: day('2026-10-05'), attendanceStatus: 'REST_DAY', lateSeconds: 999 },
        { ...attendanceInput, attendanceDate: day('2026-10-06'), attendanceStatus: 'NO_SCHEDULE', lateSeconds: 999 },
        { ...attendanceInput, attendanceDate: day('2026-10-07'), attendanceStatus: 'ABSENT', disposition: 'APPROVED_LEAVE', lateSeconds: 999 },
        { ...attendanceInput, attendanceDate: day('2026-10-08'), attendanceStatus: 'OPEN', finalizedAt: null, lateSeconds: 60 },
        { ...attendanceInput, attendanceDate: day('2026-10-09'), attendanceStatus: 'PRESENT', finalizedAt: null },
        { ...attendanceInput, attendanceDate: day('2026-09-30'), attendanceStatus: 'ABSENT', lateSeconds: 999 },
        { ...attendanceInput, employeeId: regular.employee.id, employmentRecordId: regular.employment.id, attendanceDate: day('2026-10-01'), attendanceStatus: 'PRESENT' },
        { ...attendanceInput, organizationId: b.organization.id, employeeId: privateEmployee.employee.id, employmentRecordId: privateEmployee.employment.id, attendanceDate: day('2026-10-01'), attendanceStatus: 'ABSENT', lateSeconds: 9999 },
      ] });

      const sick = await tx.leaveType.create({ data: { organizationId: a.organization.id, code: 'SICK_PERSONAL', name: 'Sick / Personal', countingMode: 'SCHEDULED_WORK_DAYS', policyReference: 'H5 fixture' } });
      const study = await tx.leaveType.create({ data: { organizationId: a.organization.id, code: 'STUDY', name: 'Study', countingMode: 'CALENDAR_DAYS', policyReference: 'H5 fixture' } });
      const privateType = await tx.leaveType.create({ data: { organizationId: b.organization.id, code: 'PRIVATE', name: 'B PRIVATE LEAVE', countingMode: 'CALENDAR_DAYS', policyReference: 'H5 fixture' } });
      async function leaveRequest(owner: typeof teaching, organizationId: string, type: typeof sick, status: LeaveRequestStatus, from: string, to = from) {
        return tx.leaveRequest.create({ data: {
          organizationId, employeeId: owner.employee.id, leaveTypeId: type.id, requestedStartDate: day(from), requestedEndDate: day(to), requestedUnits: status === 'PENDING' ? null : 3,
          status, reason: 'H8 fixture', policySnapshot: {}, leaveTypeCodeSnapshot: type.code, leaveTypeNameSnapshot: type.name, leavePaidSnapshot: type.isPaid, countingModeSnapshot: type.countingMode,
          calculationFinalizedAt: status === 'APPROVED' ? day('2026-09-29') : null,
        } });
      }
      async function requestDays(request: { id: string }, owner: typeof teaching, organizationId: string, dates: string[]) {
        await tx.leaveRequestDay.createMany({ data: dates.map(date => ({ organizationId, leaveRequestId: request.id, employeeId: owner.employee.id, employmentRecordId: owner.employment.id, attendanceDate: day(date), isScheduledWorkday: true, chargeUnits: 1, employmentSnapshot: {} })) });
      }
      const approved = await leaveRequest(teaching, a.organization.id, sick, 'APPROVED', '2026-09-30', '2026-10-07');
      await requestDays(approved, teaching, a.organization.id, ['2026-09-30', '2026-10-01', '2026-10-07']);
      await leaveRequest(teaching, a.organization.id, sick, 'PENDING', '2026-10-10');
      await leaveRequest(regular, a.organization.id, study, 'REJECTED', '2026-10-11');
      const cancelled = await leaveRequest(teaching, a.organization.id, study, 'CANCELLED', '2026-10-12');
      await requestDays(cancelled, teaching, a.organization.id, ['2026-10-12']);
      await leaveRequest(teaching, a.organization.id, study, 'WITHDRAWN', '2026-10-13');
      await leaveRequest(teaching, a.organization.id, sick, 'REJECTED', '2026-09-29');
      const privateLeave = await leaveRequest(privateEmployee, b.organization.id, privateType, 'APPROVED', '2026-10-01');
      await requestDays(privateLeave, privateEmployee, b.organization.id, ['2026-10-01']);

      const compensation = await tx.employeeCompensation.create({ data: { organizationId: a.organization.id, employeeId: teaching.employee.id, compensationType: 'MONTHLY', baseRate: 1000, payFrequency: 'MONTHLY', effectiveFrom: day('2026-01-01') } });
      const regularCompensation = await tx.employeeCompensation.create({ data: { organizationId: a.organization.id, employeeId: regular.employee.id, compensationType: 'MONTHLY', baseRate: 2000, payFrequency: 'MONTHLY', effectiveFrom: day('2026-01-01') } });
      const privateCompensation = await tx.employeeCompensation.create({ data: { organizationId: b.organization.id, employeeId: privateEmployee.employee.id, compensationType: 'MONTHLY', baseRate: 999999, payFrequency: 'MONTHLY', effectiveFrom: day('2026-01-01') } });
      async function period(tenantData: typeof a, name: string, payDate: string, status: PayrollPeriodStatus, finalized = status === 'FINALIZED') {
        return tx.payrollPeriod.create({ data: { organizationId: tenantData.organization.id, name, periodStart: day('2026-10-01'), periodEnd: day('2026-10-31'), payDate: day(payDate), status, finalizedAt: finalized ? asOf : null, finalizedById: finalized ? tenantData.hr.id : null } });
      }
      async function entry(owner: typeof teaching, compensationId: string, payrollPeriod: Awaited<ReturnType<typeof period>>, status: PayrollEntryStatus, gross: number, currency: string) {
        const deductions = new Prisma.Decimal(gross).div(10);
        const net = new Prisma.Decimal(gross).sub(deductions);
        return tx.payrollEntry.create({ data: {
          organizationId: payrollPeriod.organizationId, employeeId: owner.employee.id, employeeCompensationId: compensationId, payrollPeriodId: payrollPeriod.id, status, baseAmount: gross, grossAmount: gross, totalDeductions: deductions, netAmount: net,
          calculationSnapshot: { payrollPeriod: { id: payrollPeriod.id }, employee: { id: owner.employee.id }, compensation: { id: compensationId, type: 'MONTHLY', rate: String(gross), payFrequency: 'MONTHLY', currency }, policy: { id: 'fixture-policy', version: 1 }, calculation: { baseAmount: String(gross), grossAmount: String(gross), totalDeductions: deductions.toString(), netAmount: net.toString() } },
        } });
      }
      const php = await period(a, 'PHP final', '2026-10-15', 'FINALIZED');
      await entry(teaching, compensation.id, php, 'FINALIZED', 1000, 'PHP');
      await entry(regular, regularCompensation.id, php, 'FINALIZED', 2000, 'PHP');
      const usd = await period(a, 'USD final', '2026-10-20', 'FINALIZED');
      await entry(regular, regularCompensation.id, usd, 'FINALIZED', 500, 'USD');
      const draft = await period(a, 'Draft', '2026-10-22', 'DRAFT');
      await entry(teaching, compensation.id, draft, 'DRAFT', 999999, 'PHP');
      const review = await period(a, 'Unfinalized review', '2026-10-23', 'REVIEW');
      await entry(teaching, compensation.id, review, 'FINALIZED', 888888, 'PHP');
      const noTimestamp = await period(a, 'Missing finalization timestamp', '2026-10-24', 'FINALIZED', false);
      await entry(teaching, compensation.id, noTimestamp, 'FINALIZED', 777777, 'PHP');
      const outside = await period(a, 'Outside range', '2026-11-05', 'FINALIZED');
      await entry(teaching, compensation.id, outside, 'FINALIZED', 666666, 'PHP');
      const privatePeriod = await period(b, 'B PRIVATE PAYROLL', '2026-10-15', 'FINALIZED');
      await entry(privateEmployee, privateCompensation.id, privatePeriod, 'FINALIZED', 999999, 'PHP');
      // Later compensation changes must not alter finalized snapshot currency.
      await tx.employeeCompensation.update({ where: { id: compensation.id }, data: { currency: 'EUR' } });
      const before = await tx.dailyAttendanceRecord.findMany({ where: { organizationId: a.organization.id }, select: { id: true, updatedAt: true, attendanceStatus: true } });

      const result = await readAnalytics(session(a.hr), tx, {}, asOf);
      if (process.env.WORKPULSE_BATCH2_PARITY === '1') {
        const { readDashboardData } = await import('../src/features/dashboard/read-model');
        const { readDashboardData: legacyDashboard } = await import('./reference/batch2-dashboard');
        const { readOrganizationBranding } = await import('../src/features/organization-branding/data');
        const branding = await readOrganizationBranding(tx, { id: a.organization.id });
        ok(branding, 'fixture organization branding resolves');
        for (const actor of [a.hr, admin, manager]) {
          const original = await legacyDashboard(session(actor), asOf, tx, branding);
          const optimized = await readDashboardData(session(actor), asOf, tx, branding);
          ok(JSON.stringify(original) === JSON.stringify(optimized), `Dashboard complete view model matches the prior implementation for ${actor.role}`);
        }
      }
      ok(canViewAnalytics(session(a.hr)) && result.workforce.active === 4, 'HR Admin can access tenant analytics');
      const adminResult = await readAnalytics(session(admin), tx, {}, asOf);
      ok(canViewAnalytics(session(admin)) && JSON.stringify(adminResult) === JSON.stringify(result), 'Organization Admin receives the same tenant analytics');
      ok(!canViewAnalytics(session(manager)) && await denied(() => readAnalytics(session(manager), tx, {}, asOf)), 'Hiring Manager denied');
      ok(!canViewAnalytics(session(employeeUser)) && await denied(() => readAnalytics(session(employeeUser), tx, {}, asOf)), 'Employee denied');
      ok(await denied(() => readAnalytics(null, tx)), 'unauthenticated access denied');
      ok(await denied(() => readAnalytics({ ...session(manager), role: Role.HR_ADMIN }, tx)), 'forged role is rejected against persisted user');
      ok(await denied(() => readAnalytics({ ...session(a.hr), organizationId: b.organization.id }, tx)), 'forged tenant is rejected against persisted user');
      const injected = await readAnalytics(session(a.hr), tx, { organizationId: b.organization.id } as AnalyticsFilters, asOf);
      ok(JSON.stringify(injected) === JSON.stringify(result), 'client tenant filter is ignored');
      ok(!JSON.stringify(result).includes('b-private') && !JSON.stringify(result).includes('B PRIVATE'), 'tenant B employees, probation, leave and payroll are absent');
      ok(result.workforce.active === 4 && result.workforce.regular === 1 && result.workforce.probationary === 2, 'employment history and future records do not double-count employees');
      ok(result.workforce.teaching === 1 && result.workforce.nonTeaching === 2 && result.workforce.unclassified === 1 && result.workforce.inactive === 1 && result.workforce.separated === 1, 'current category/status and missing-employment counts are accurate');
      ok(result.workforce.conversions === 1, 'conversion date uses tenant local boundaries');
      // Includes the separated employee's one pre-existing PRESENT/late day:
      // four finalized PRESENT days / six finalized workdays = 66.7%.
      ok(result.attendance.rate === 66.7 && result.attendance.finalizedWorkdays === 6, 'rate excludes rest/no-schedule/approved leave/open/unfinalized records and retains separated employee history');
      ok(result.attendance.recordedDays === 11 && result.attendance.absentDays === 1, 'missing attendance is never inferred as absence');
      ok(result.attendance.presentDays === 5 && result.attendance.incompleteDays === 1 && result.attendance.approvedLeaveDays === 1 && result.attendance.openDays === 1, 'stored attendance outcomes are aggregated correctly');
      ok(result.attendance.lateOccurrences === 4 && result.attendance.lateLeaders[0].count === 3 && result.attendance.lateLeaders[0].lateMinutes === 4, 'late counts/minutes exclude leave/rest/no-schedule and out-of-range rows');
      ok(result.leave.requests === 5 && result.leave.approved === 1 && result.leave.pending === 1 && result.leave.rejected === 1 && result.leave.cancelled === 1 && result.leave.withdrawn === 1, 'pending/approved/rejected/closed request counts use overlapping leave dates');
      ok(result.leave.approvedUnits === '2', 'approved units use in-range finalized day charges, excluding cancellation and tenant B');
      ok(result.leave.byType.length === 2 && result.leave.byType.find(type => type.name === 'Sick / Personal')?.count === 2, 'leave breakdown uses existing tenant types');
      ok(result.payroll.entries === 6 && result.payroll.finalizedEntries === 3 && result.payroll.finalizedPeriods === 2, 'payroll counts distinguish entries from valid finalized periods');
      ok(result.payroll.totals.find(total => total.currency === 'PHP')?.gross === '3000.00' && result.payroll.totals.find(total => total.currency === 'PHP')?.deductions === '300.00' && result.payroll.totals.find(total => total.currency === 'PHP')?.net === '2700.00', 'H6 totals exclude draft/review/incomplete-finalization and tenant B payroll');
      ok(result.payroll.totals.find(total => total.currency === 'USD')?.net === '450.00' && !result.payroll.totals.some(total => total.currency === 'EUR'), 'snapshot currencies remain separate after compensation changes');
      ok(!JSON.stringify(result).includes('salary') && !JSON.stringify(result).includes('calculationSnapshot') && !JSON.stringify(result.payroll).includes('a-teaching'), 'main payroll analytics exposes no individual salary or raw snapshots');
      ok(result.employment.activeProbationCases === 2 && result.employment.teachingCases === 1 && result.employment.nonTeachingCases === 1, 'probation uses current active pending cases, excluding history/future/inactive cases');
      ok(result.employment.teachingEndingSoon === 1 && result.employment.actionCount === 2 && result.employment.actions.some(action => action.status === 'OVERDUE_FOR_REVIEW') && result.employment.actions.some(action => action.status === 'ENDING_SOON'), 'upcoming actions reuse H2 review states and school-year probation dates');

      const filtered = await readAnalytics(session(a.hr), tx, { category: 'TEACHING' }, asOf);
      ok(filtered.workforce.active === 1 && filtered.workforce.inactive === 1 && filtered.workforce.regular === 0, 'employee type selects CURRENT category, not historical/future category');
      ok(filtered.attendance.presentDays === 3 && filtered.attendance.rate === 50 && filtered.leave.rejected === 0, 'employee type applies to attendance and leave');
      ok(filtered.payroll.finalizedEntries === 1 && filtered.payroll.totals[0].gross === '1000.00' && filtered.payroll.totals.length === 1 && filtered.employment.activeProbationCases === 1, 'employee type applies to payroll and probation');
      const oneDay = await readAnalytics(session(a.hr), tx, { preset: 'custom', from: '2026-10-01', to: '2026-10-01' }, asOf);
      ok(oneDay.attendance.recordedDays === 2 && oneDay.attendance.absentDays === 0 && oneDay.leave.approvedUnits === '1' && oneDay.leave.requests === 1 && oneDay.payroll.entries === 0, 'custom date range restricts attendance, leave units/requests, and payroll pay dates');
      const oldRange = await readAnalytics(session(a.hr), tx, { preset: 'custom', from: '2000-01-01', to: '2000-01-31' }, asOf);
      ok(oldRange.attendance.recordedDays === 0 && oldRange.attendance.rate === null && oldRange.leave.requests === 0 && oldRange.payroll.totals.length === 0 && oldRange.workforce.conversions === 0 && oldRange.workforce.active === 4, 'empty historical range has safe empties while current workforce remains current');
      const empty = await readAnalytics(session(emptyTenant.hr), tx, {}, asOf);
      ok(empty.workforce.active === 0 && empty.attendance.rate === null && empty.attendance.absentDays === 0 && empty.leave.approvedUnits === '0' && empty.payroll.entries === 0 && empty.payroll.periods.length === 0 && empty.employment.actions.length === 0, 'empty tenant returns zeros and empty states safely');

      for (const [owner, index] of [[regular, 0], [nonTeaching, 1], [inactive, 2], [separated, 3]] as const) {
        const data = { ...attendanceInput, employeeId: owner.employee.id, employmentRecordId: owner.employment.id, attendanceDate: day(`2026-10-${20 + index}`), attendanceStatus: 'PRESENT' as const, lateSeconds: 60 };
        if (!owner.historicalAttendance) await tx.dailyAttendanceRecord.create({ data });
      }
      const sixth = await employee(a, 'a-sixth-late', 'NON_TEACHING', 'ACTIVE', 'REGULAR');
      await tx.dailyAttendanceRecord.create({ data: { ...attendanceInput, employeeId: sixth.employee.id, employmentRecordId: sixth.employment.id, attendanceDate: day('2026-10-24'), attendanceStatus: 'PRESENT', lateSeconds: 30 } });
      const ranking = await readAnalytics(session(a.hr), tx, {}, asOf);
      ok(ranking.attendance.lateLeaders.length === 5 && ranking.attendance.lateOccurrences === 8, 'top five ranking does not truncate the total late occurrence metric');
      const after = await tx.dailyAttendanceRecord.findMany({ where: { organizationId: a.organization.id, id: { in: before.map(row => row.id) } }, select: { id: true, updatedAt: true, attendanceStatus: true } });
      ok(JSON.stringify(before.sort((x, y) => x.id.localeCompare(y.id))) === JSON.stringify(after.sort((x, y) => x.id.localeCompare(y.id))), 'analytics does not mutate stored attendance');
      throw rollback;
    }, { timeout: 180_000 });
  } catch (error) { if (error !== rollback) throw error; }
  ok(await prisma.organization.count({ where: { slug: { startsWith: marker } } }) === 0, 'all H8 fixtures roll back cleanly');
  console.log(`H8 Analytics integration tests passed: ${assertions} assertions.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
