import {
  Prisma,
  ApplicationStatus,
  AttendanceDirection,
  AttendanceDerivation,
  AttendanceSource,
  AttendanceStatus,
  EmploymentCategory,
  EmploymentStatus,
  JobStatus,
  PayFrequency,
  Role,
} from '@prisma/client';
import { prisma } from '../src/lib/db/prisma';
import {
  attendanceDateForInstant,
  calculateAttendanceDurations,
  deriveAttendanceStatus,
  instantForLocalSecond,
  pairAttendanceEvents,
  summarizeAttendanceIndicators,
} from '../src/features/attendance/domain';
import { assignSchedule, materializeAttendanceDay, materializeAttendancePeriod, recordAttendanceEvent, correctAttendance } from '../src/features/attendance/service';
import { canCorrectAttendance, canManageSchedules, canViewAttendance } from '../src/lib/permissions/rbac';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

class RollbackTest extends Error {}

async function main() {
  let assertions = 0;
  const ok = (condition: unknown, message: string) => { assert(condition, message); assertions += 1; };
  ok(attendanceDateForInstant(new Date('2026-09-08T16:30:00Z'), 'Asia/Manila') === '2026-09-09', 'organization-local attendance date crosses UTC midnight');
  ok(instantForLocalSecond('2026-03-08', 86_400, 'America/New_York').getTime() - instantForLocalSecond('2026-03-08', 0, 'America/New_York').getTime() === 23 * 3600_000, 'DST local day does not assume 24 hours');
  const start = instantForLocalSecond('2026-09-09', 8 * 3600, 'Asia/Manila');
  const end = instantForLocalSecond('2026-09-09', 17 * 3600, 'Asia/Manila');
  ok(start.toISOString() === '2026-09-09T00:00:00.000Z', 'local schedule start resolves to UTC');
  const pairing = pairAttendanceEvents([
    { id: 'out-early', occurredAt: new Date('2026-09-08T23:59:00Z'), direction: AttendanceDirection.TIME_OUT },
    { id: 'in-2', occurredAt: new Date('2026-09-09T00:05:00Z'), direction: AttendanceDirection.TIME_IN },
    { id: 'in-repeat', occurredAt: new Date('2026-09-09T00:06:00Z'), direction: AttendanceDirection.TIME_IN },
    { id: 'neutral', occurredAt: new Date('2026-09-09T00:07:00Z'), direction: null },
    { id: 'out', occurredAt: new Date('2026-09-09T09:30:00Z'), direction: AttendanceDirection.TIME_OUT },
  ]);
  ok(pairing.firstTimeIn?.toISOString() === '2026-09-09T00:05:00.000Z', 'first directed time-in wins');
  ok(pairing.lastTimeOut?.toISOString() === '2026-09-09T09:30:00.000Z', 'last valid time-out wins');
  ok(pairing.hasOutBeforeIn && pairing.hasUnclassifiedEvents, 'pairing exposes anomalies');
  const durations = calculateAttendanceDurations({ attendanceDate: '2026-09-09', timeZone: 'Asia/Manila', scheduledStartAt: start, scheduledEndAt: end, lateGraceSeconds: 0, breaks: [{ startSecond: 43_200, endSecond: 46_800, isPaid: false }], firstTimeIn: pairing.firstTimeIn, lastTimeOut: pairing.lastTimeOut });
  ok(durations.lateSeconds === 300, 'late seconds use zero grace');
  ok(durations.overtimeSeconds === 1800, 'overtime is detected without authorization');
  ok(durations.undertimeSeconds === 0, 'no undertime after scheduled end');
  ok(durations.workedSeconds === 30_300, 'worked seconds deduct overlapping unpaid break');
  ok(deriveAttendanceStatus({ isWorkday: true, scheduledEndAt: end, asOf: new Date('2026-09-09T07:00:00Z'), pairing: { firstTimeIn: null, lastTimeOut: null, hasOutBeforeIn: false, hasUnclassifiedEvents: false }, eventCount: 0 }).status === AttendanceStatus.OPEN, 'absence is not premature');
  ok(deriveAttendanceStatus({ isWorkday: true, scheduledEndAt: end, asOf: new Date('2026-09-09T10:00:00Z'), pairing: { firstTimeIn: null, lastTimeOut: null, hasOutBeforeIn: false, hasUnclassifiedEvents: false }, eventCount: 0 }).status === AttendanceStatus.ABSENT, 'absence follows completed workday');
  ok(deriveAttendanceStatus({ isWorkday: true, scheduledEndAt: end, asOf: new Date('2026-09-09T10:00:00Z'), pairing: { firstTimeIn: start, lastTimeOut: null, hasOutBeforeIn: false, hasUnclassifiedEvents: false }, eventCount: 1 }).status === AttendanceStatus.INCOMPLETE, 'missing time-out is incomplete after day end');
  ok(deriveAttendanceStatus({ isWorkday: true, scheduledEndAt: end, asOf: new Date('2026-09-09T10:00:00Z'), pairing: { firstTimeIn: null, lastTimeOut: null, hasOutBeforeIn: true, hasUnclassifiedEvents: false }, eventCount: 1 }).status === AttendanceStatus.INCOMPLETE, 'missing time-in is incomplete after day end');
  ok(deriveAttendanceStatus({ isWorkday: false, scheduledEndAt: null, asOf: end, pairing, eventCount: 5 }).status === AttendanceStatus.REST_DAY, 'rest day is distinct');
  ok(deriveAttendanceStatus({ isWorkday: null, scheduledEndAt: null, asOf: end, pairing, eventCount: 5 }).status === AttendanceStatus.NO_SCHEDULE, 'no schedule is distinct');
  const indicators = summarizeAttendanceIndicators([
    ...[1, 2, 3, 4].map((day) => ({ attendanceDate: `2026-09-0${day}`, status: AttendanceStatus.PRESENT, lateSeconds: 60 })),
    ...[5, 6, 7, 8, 9].map((day) => ({ attendanceDate: `2026-09-0${day}`, status: AttendanceStatus.ABSENT, lateSeconds: 0 })),
  ]);
  ok(indicators.habitualTardinessReview, 'four tardiness instances trigger neutral review');
  ok(indicators.absenceFrequencyReview, 'three absence days trigger neutral review');
  ok(indicators.possibleAwolPatternReview && indicators.unauthorizedAbsenceDays === null, 'five-day pattern does not classify authorization or discipline');
  const hiringManager = { userId: 'test', organizationId: 'test', email: 'test', name: 'test', role: Role.HIRING_MANAGER };
  ok(!canViewAttendance(hiringManager) && !canManageSchedules(hiringManager) && !canCorrectAttendance(hiringManager), 'Hiring Manager cannot access H3 attendance');
  const hrAdmin = { ...hiringManager, role: Role.HR_ADMIN };
  ok(canViewAttendance(hrAdmin) && canManageSchedules(hrAdmin) && canCorrectAttendance(hrAdmin), 'HR Admin receives attendance permissions');

  // This suite writes immutable evidence. Its owner must dispose of the private schema.
  assert(/^batch3_test_[a-f0-9]{24}$/.test(new URL(process.env.DATABASE_URL!).searchParams.get('schema') ?? ''), 'H3 requires a disposable Batch 3 schema');
  const marker = `h3-${Date.now()}`;
  const organization = await prisma.organization.create({ data: { name: 'H3 Test', slug: marker, timeZone: 'Asia/Manila' } });
  const other = await prisma.organization.create({ data: { name: 'Other', slug: marker + '-other' } });
  const actor = await prisma.user.create({ data: { organizationId: organization.id, name: 'Synthetic HR', email: marker + '@test.invalid', role: Role.HR_ADMIN } });
  const job = await prisma.job.create({ data: { organizationId: organization.id, title: 'Synthetic', slug: marker, department: 'Test', employmentType: 'Full-time', location: 'Test', description: 'Test', responsibilities: 'Test', qualifications: 'Test', requirements: 'Test', status: JobStatus.CLOSED } });
  const employees: Array<{ id: string }> = [];
  for (const suffix of ['one', 'two']) {
    const applicant = await prisma.applicant.create({ data: { firstName: 'Synthetic', lastName: suffix, email: `${marker}-${suffix}@test.invalid`, phone: '0' } });
    const application = await prisma.application.create({ data: { jobId: job.id, applicantId: applicant.id, status: ApplicationStatus.HIRED, coverLetter: 'Fixture' } });
    const employee = await prisma.employee.create({ data: { organizationId: organization.id, sourceApplicationId: application.id, applicantId: applicant.id, employeeNumber: suffix, firstName: 'Synthetic', lastName: suffix, email: applicant.email, phone: '0', createdById: actor.id } });
    await prisma.employmentRecord.create({ data: { employeeId: employee.id, jobId: job.id, jobTitle: job.title, department: 'Test', employmentCategory: EmploymentCategory.NON_TEACHING, employmentType: 'Full-time', hireDate: new Date('2026-01-01Z'), startDate: new Date('2026-01-01Z'), salary: 1, payFrequency: PayFrequency.MONTHLY, employmentStatus: EmploymentStatus.REGULAR, effectiveFrom: new Date('2026-01-01Z'), createdById: actor.id } });
    employees.push(employee);
  }
  const group = await prisma.workScheduleGroup.create({ data: { organizationId: organization.id, scheduleKey: marker, name: 'Morning', createdById: actor.id } });
  const version = await prisma.workScheduleVersion.create({ data: { scheduleGroupId: group.id, version: 1, displayName: 'Morning', lateGraceSeconds: 0, createdById: actor.id, days: { create: Array.from({ length: 7 }, (_, i) => ({ isoWeekday: i + 1, isWorkday: i < 5, expectedStartSecond: i < 5 ? 28800 : null, expectedEndSecond: i < 5 ? 61200 : null })) } } });
  const version2 = await prisma.workScheduleVersion.create({ data: { scheduleGroupId: group.id, version: 2, displayName: 'Morning', createdById: actor.id } });
  ok(version.displayName === version2.displayName, 'schedule name supports immutable versions');
  const context = { organizationId: organization.id, actorUserId: actor.id };
  await assignSchedule({ ...context, employeeId: employees[0].id, scheduleVersionId: version.id, effectiveFrom: '2026-01-01' });
  let overlap = false;
  try { await prisma.employeeScheduleAssignment.create({ data: { organizationId: organization.id, employeeId: employees[0].id, scheduleVersionId: version.id, effectiveFrom: new Date('2026-06-01Z'), createdById: actor.id } }); } catch { overlap = true; }
  ok(overlap, 'database exclusion constraint rejects overlapping assignments');
  const inEvent = { ...context, employeeId: employees[0].id, occurredAt: new Date('2026-09-09T00:05:00Z'), direction: AttendanceDirection.TIME_IN, source: AttendanceSource.MANUAL, sourceReference: 'concurrent-in' };
  const results = await Promise.all([recordAttendanceEvent(inEvent), recordAttendanceEvent(inEvent)]);
  ok(results.filter(r => r.idempotent).length === 1 && results[0].eventId === results[1].eventId, 'concurrent identical events persist once');
  let conflict = false;
  try { await recordAttendanceEvent({ ...inEvent, occurredAt: new Date('2026-09-09T00:06:00Z') }); } catch (error) { conflict = error instanceof Error && 'code' in error && error.code === 'IDEMPOTENCY_CONFLICT'; }
  ok(conflict && await prisma.attendanceEvent.count() === 1, 'conflicting reference rolls back without replacing evidence');
  await recordAttendanceEvent({ ...inEvent, occurredAt: new Date('2026-09-09T08:30:00Z'), direction: AttendanceDirection.TIME_OUT, sourceReference: 'time-out' });
  const dayInput = { organizationId: organization.id, employeeId: employees[0].id, attendanceDate: '2026-09-09', asOf: new Date('2026-09-10T00:00:00Z') };
  const record = await prisma.$transaction(tx => materializeAttendanceDay(tx, dayInput), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  ok(record.attendanceStatus === AttendanceStatus.PRESENT && record.lateSeconds === 300 && record.undertimeSeconds === 1800, 'time in/out retain exact late and undertime');
  const beforeRaw = await prisma.attendanceEvent.count();
  const correction = { ...context, dailyAttendanceRecordId: record.id, expectedRevision: 0, correctedTimeIn: start, correctedTimeOut: end, correctedStatus: AttendanceStatus.PRESENT, reason: 'Verified synthetic correction' };
  const corrected = await Promise.allSettled([correctAttendance(correction), correctAttendance(correction)]);
  ok(corrected.filter(r => r.status === 'fulfilled').length === 1, 'only one concurrent correction revision commits');
  const rejected = corrected.find(r => r.status === 'rejected');
  ok(rejected?.status === 'rejected' && rejected.reason.code === 'CONCURRENT_UPDATE', 'losing correction reports stale revision');
  const projection = await prisma.dailyAttendanceRecord.findUniqueOrThrow({ where: { id: record.id } });
  ok(projection.derivation === AttendanceDerivation.CORRECTED && projection.lateSeconds === 0 && projection.correctionVersion === 1, 'latest correction controls projection');
  ok(await prisma.attendanceEvent.count() === beforeRaw, 'correction preserves raw evidence');
  let immutable = false;
  try { await prisma.attendanceEvent.update({ where: { id: results[0].eventId }, data: { occurredAt: new Date() } }); } catch { immutable = true; }
  ok(immutable, 'database trigger rejects raw event mutation');
  let denied = false;
  try { await prisma.attendanceEvent.create({ data: { organizationId: other.id, employeeId: employees[0].id, occurredAt: new Date(), direction: AttendanceDirection.TIME_IN, source: AttendanceSource.MANUAL, sourceReference: 'cross-tenant', createdById: actor.id } }); } catch { denied = true; }
  ok(denied, 'database rejects cross tenant evidence');
  const rollbackReference = 'rollback-event';
  try {
    await prisma.$transaction(async tx => {
      await tx.attendanceEvent.create({ data: { organizationId: organization.id, employeeId: employees[0].id, occurredAt: start, direction: AttendanceDirection.TIME_IN, source: AttendanceSource.MANUAL, sourceReference: rollbackReference, createdById: actor.id } });
      await materializeAttendanceDay(tx, dayInput);
      throw new RollbackTest();
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) { if (!(error instanceof RollbackTest)) throw error; }
  ok(await prisma.attendanceEvent.count({ where: { sourceReference: rollbackReference } }) === 0, 'event and materialization rollback atomically');
  ok(JSON.stringify(await prisma.dailyAttendanceRecord.findUniqueOrThrow({ where: { id: record.id } })) === JSON.stringify(projection), 'rolled back recalculation preserves the prior projection exactly');
  const noSchedule = await prisma.$transaction(tx => materializeAttendanceDay(tx, { ...dayInput, employeeId: employees[1].id }));
  ok(noSchedule.attendanceStatus === AttendanceStatus.NO_SCHEDULE, 'missing schedule is not absence');
  const rest = await prisma.$transaction(tx => materializeAttendanceDay(tx, { ...dayInput, attendanceDate: '2026-09-12' }));
  ok(rest.attendanceStatus === AttendanceStatus.REST_DAY, 'rest day is not absence');
  await assignSchedule({ ...context, employeeId: employees[1].id, scheduleVersionId: version.id, effectiveFrom: '2026-09-07' });
  const periodInput = { ...context, employeeIds: employees.map(e => e.id), from: '2026-09-07', to: '2026-09-09', asOf: dayInput.asOf };
  const periods = await Promise.all([materializeAttendancePeriod(periodInput), materializeAttendancePeriod(periodInput)]);
  ok(periods.every(r => r.materializedCount === 6), 'concurrent period processing completes with bounded serialization retry');
  ok(await prisma.dailyAttendanceRecord.count({ where: { organizationId: organization.id, attendanceDate: { gte: new Date('2026-09-07Z'), lte: new Date('2026-09-09Z') } } }) === 6, 'concurrent materialization has one projection per employee/day');
  const before = await prisma.dailyAttendanceRecord.count();
  await prisma.dailyAttendanceRecord.findMany({ where: { organizationId: organization.id } });
  ok(await prisma.dailyAttendanceRecord.count() === before, 'reads do not materialize projections');
  console.log(`H3 Attendance Foundation tests passed: ${assertions} assertions.`);
}

main().catch(error => {
  const known = ['Cross-tenant attendance event', 'Cross-tenant attendance actor', 'New active-employee work is unavailable after separation', 'AttendanceEvent_manual_requires_direction', 'Attendance employment record mismatch'];
  console.error('H3_FAILURE', JSON.stringify({ code: error.code, recognizedMessages: known.filter(s => String(error).includes(s)) }));
  console.error(error); process.exitCode = 1;
}).finally(() => prisma.$disconnect());
