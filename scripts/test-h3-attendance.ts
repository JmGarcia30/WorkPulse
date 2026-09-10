import {
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
import { assignSchedule, materializeAttendanceDay, materializeAttendancePeriod } from '../src/features/attendance/service';
import { canCorrectAttendance, canManageSchedules, canViewAttendance } from '../src/lib/permissions/rbac';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

class RollbackTest extends Error {}

async function main() {
  let assertions = 0;
  let transactionMarker = '';
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

  try {
    await prisma.$transaction(async (tx) => {
      const marker = `h3-${Date.now()}`;
      transactionMarker = marker;
      const organization = await tx.organization.create({ data: { name: 'H3 Test', slug: marker, timeZone: 'Asia/Manila' } });
      const otherOrganization = await tx.organization.create({ data: { name: 'H3 Other Tenant', slug: `${marker}-other`, timeZone: 'UTC' } });
      const actor = await tx.user.create({ data: { organizationId: organization.id, name: 'H3 HR', email: `${marker}@test.invalid`, passwordHash: 'test', role: Role.HR_ADMIN } });
      const job = await tx.job.create({ data: { organizationId: organization.id, title: 'H3 Job', slug: marker, department: 'Test', employmentType: 'Full-Time', location: 'Test', description: 'Test', responsibilities: 'Test', qualifications: 'Test', requirements: 'Test', status: JobStatus.CLOSED, category: EmploymentCategory.NON_TEACHING } });
      const applicant = await tx.applicant.create({ data: { firstName: 'H3', lastName: 'Employee', email: `${marker}-employee@test.invalid`, phone: '0' } });
      const application = await tx.application.create({ data: { jobId: job.id, applicantId: applicant.id, status: ApplicationStatus.HIRED, coverLetter: 'H3 test fixture' } });
      const employee = await tx.employee.create({ data: { organizationId: organization.id, sourceApplicationId: application.id, applicantId: applicant.id, employeeNumber: marker, firstName: 'H3', lastName: 'Employee', email: applicant.email, phone: '0', createdById: actor.id } });
      const employment = await tx.employmentRecord.create({ data: { employeeId: employee.id, jobId: job.id, jobTitle: job.title, department: job.department, employmentCategory: EmploymentCategory.NON_TEACHING, employmentType: 'Full-Time', hireDate: new Date('2026-01-01Z'), startDate: new Date('2026-01-01Z'), salary: 1, payFrequency: PayFrequency.MONTHLY, employmentStatus: EmploymentStatus.REGULAR, effectiveFrom: new Date('2026-01-01Z'), createdById: actor.id } });
      const group = await tx.workScheduleGroup.create({ data: { organizationId: organization.id, scheduleKey: 'morning', name: 'Morning Shift', createdById: actor.id } });
      const version1 = await tx.workScheduleVersion.create({ data: { scheduleGroupId: group.id, version: 1, displayName: 'Morning Shift', lateGraceSeconds: 0, createdById: actor.id, days: { create: Array.from({ length: 7 }, (_, index) => ({ isoWeekday: index + 1, isWorkday: index < 5, expectedStartSecond: index < 5 ? 28_800 : null, expectedEndSecond: index < 5 ? 61_200 : null })) } } });
      const version2 = await tx.workScheduleVersion.create({ data: { scheduleGroupId: group.id, version: 2, displayName: 'Morning Shift', lateGraceSeconds: 0, createdById: actor.id } });
      ok(version1.displayName === version2.displayName, 'same logical schedule name supports immutable versions');
      await tx.employeeScheduleAssignment.create({ data: { organizationId: organization.id, employeeId: employee.id, scheduleVersionId: version1.id, effectiveFrom: new Date('2026-01-01Z'), createdById: actor.id } });
      await tx.$executeRawUnsafe('SAVEPOINT h3_overlap');
      let overlapBlocked = false;
      try { await tx.employeeScheduleAssignment.create({ data: { organizationId: organization.id, employeeId: employee.id, scheduleVersionId: version1.id, effectiveFrom: new Date('2026-06-01Z'), createdById: actor.id } }); } catch { overlapBlocked = true; await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT h3_overlap'); }
      ok(overlapBlocked, 'database exclusion constraint blocks overlapping assignments');
      await tx.attendanceEvent.createMany({ data: [
        { organizationId: organization.id, employeeId: employee.id, occurredAt: new Date('2026-09-09T00:05:00Z'), direction: AttendanceDirection.TIME_IN, source: AttendanceSource.MANUAL, sourceReference: 'manual:test-in', createdById: actor.id },
        { organizationId: organization.id, employeeId: employee.id, occurredAt: new Date('2026-09-09T09:30:00Z'), direction: AttendanceDirection.TIME_OUT, source: AttendanceSource.MANUAL, sourceReference: 'manual:test-out', createdById: actor.id },
      ] });
      const record = await materializeAttendanceDay(tx, { organizationId: organization.id, employeeId: employee.id, attendanceDate: '2026-09-09', asOf: new Date('2026-09-09T10:00:00Z') });
      ok(record.employmentRecordId === employment.id && record.attendanceStatus === AttendanceStatus.PRESENT, 'materialization persists tenant-scoped DTR');
      ok(record.lateGraceSeconds === 0 && record.lateSeconds === 300, 'database and projection accept zero grace');
      const duplicate = await tx.attendanceEvent.createMany({ skipDuplicates: true, data: [{ organizationId: organization.id, employeeId: employee.id, occurredAt: new Date('2026-09-09T00:05:00Z'), direction: AttendanceDirection.TIME_IN, source: AttendanceSource.MANUAL, sourceReference: 'manual:test-in', createdById: actor.id }] });
      ok(duplicate.count === 0 && await tx.attendanceEvent.count({ where: { organizationId: organization.id } }) === 2, 'source reference makes repeated ingestion idempotent');
      const rawBeforeCorrection = await tx.attendanceEvent.count({ where: { organizationId: organization.id } });
      await tx.attendanceCorrection.create({ data: {
        organizationId: organization.id, dailyAttendanceRecordId: record.id, revision: 1,
        correctedTimeIn: new Date('2026-09-09T00:00:00Z'), correctedTimeOut: new Date('2026-09-09T09:00:00Z'),
        correctedStatus: AttendanceStatus.PRESENT, reason: 'Verified against the signed paper DTR.',
        previousState: { firstTimeIn: record.firstTimeIn?.toISOString() ?? null },
        correctedState: { firstTimeIn: '2026-09-09T00:00:00.000Z' }, createdById: actor.id,
      } });
      const corrected = await materializeAttendanceDay(tx, { organizationId: organization.id, employeeId: employee.id, attendanceDate: '2026-09-09', asOf: new Date('2026-09-09T10:00:00Z') });
      ok(corrected.derivation === AttendanceDerivation.CORRECTED && corrected.correctionVersion === 1 && corrected.lateSeconds === 0, 'latest correction snapshot drives recalculated projection');
      ok(await tx.attendanceEvent.count({ where: { organizationId: organization.id } }) === rawBeforeCorrection, 'raw evidence remains preserved after correction');
      await tx.$executeRawUnsafe('SAVEPOINT h3_event_immutable');
      let eventImmutable = false;
      try { await tx.attendanceEvent.updateMany({ where: { organizationId: organization.id }, data: { occurredAt: new Date() } }); } catch { eventImmutable = true; await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT h3_event_immutable'); }
      ok(eventImmutable, 'database trigger rejects raw-event mutation');
      await tx.$executeRawUnsafe('SAVEPOINT h3_cross_tenant');
      let crossTenantBlocked = false;
      try { await tx.attendanceEvent.create({ data: { organizationId: otherOrganization.id, employeeId: employee.id, occurredAt: new Date(), source: AttendanceSource.RFID, sourceReference: 'cross-tenant' } }); } catch { crossTenantBlocked = true; await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT h3_cross_tenant'); }
      ok(crossTenantBlocked, 'database trigger blocks cross-tenant attendance evidence');
      const before = await tx.dailyAttendanceRecord.count();
      await tx.dailyAttendanceRecord.findMany({ where: { organizationId: organization.id } });
      ok(await tx.dailyAttendanceRecord.count() === before, 'read query does not materialize or mutate projections');
      throw new RollbackTest();
    });
  } catch (error) {
    if (!(error instanceof RollbackTest)) throw error;
  }
  ok(await prisma.organization.count({ where: { slug: transactionMarker } }) === 0, 'H3 fixture transaction rolls back completely');
  const periodMarker = `h3-period-${Date.now()}`;
  const periodApplicantIds: string[] = [];
  const periodFixture = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({ data: { name: 'H3 Period Test', slug: periodMarker, timeZone: 'Asia/Manila' } });
    const actor = await tx.user.create({ data: { organizationId: organization.id, name: 'H3 Period HR', email: `${periodMarker}@test.invalid`, passwordHash: 'test', role: Role.HR_ADMIN } });
    const job = await tx.job.create({ data: { organizationId: organization.id, title: 'H3 Period Job', slug: periodMarker, department: 'Test', employmentType: 'Full-Time', location: 'Test', description: 'Test', responsibilities: 'Test', qualifications: 'Test', requirements: 'Test', status: JobStatus.CLOSED, category: EmploymentCategory.NON_TEACHING } });
    const group = await tx.workScheduleGroup.create({ data: { organizationId: organization.id, scheduleKey: 'period-shift', name: 'Period Shift', createdById: actor.id } });
    const version = await tx.workScheduleVersion.create({ data: { scheduleGroupId: group.id, version: 1, displayName: 'Period Shift', lateGraceSeconds: 0, createdById: actor.id, days: { create: Array.from({ length: 7 }, (_, index) => ({ isoWeekday: index + 1, isWorkday: index < 5, expectedStartSecond: index < 5 ? 28_800 : null, expectedEndSecond: index < 5 ? 61_200 : null })) } } });
    const employees = [];
    for (const suffix of ['one', 'two']) {
      const applicant = await tx.applicant.create({ data: { firstName: 'Period', lastName: suffix, email: `${periodMarker}-${suffix}@test.invalid`, phone: '0' } });
      periodApplicantIds.push(applicant.id);
      const application = await tx.application.create({ data: { jobId: job.id, applicantId: applicant.id, status: ApplicationStatus.HIRED, coverLetter: 'H3 period fixture' } });
      const employee = await tx.employee.create({ data: { organizationId: organization.id, sourceApplicationId: application.id, applicantId: applicant.id, employeeNumber: `${periodMarker}-${suffix}`, firstName: 'Period', lastName: suffix, email: applicant.email, phone: '0', createdById: actor.id } });
      await tx.employmentRecord.create({ data: { employeeId: employee.id, jobId: job.id, jobTitle: job.title, department: job.department, employmentCategory: EmploymentCategory.NON_TEACHING, employmentType: 'Full-Time', hireDate: new Date('2026-01-01Z'), startDate: new Date('2026-01-01Z'), salary: 1, payFrequency: PayFrequency.MONTHLY, employmentStatus: EmploymentStatus.REGULAR, effectiveFrom: new Date('2026-01-01Z'), createdById: actor.id } });
      employees.push(employee);
    }
    return { organization, actor, version, employees };
  });
  try {
    for (const employee of periodFixture.employees) {
      await assignSchedule({ organizationId: periodFixture.organization.id, actorUserId: periodFixture.actor.id, employeeId: employee.id, scheduleVersionId: periodFixture.version.id, effectiveFrom: '2026-09-07' });
    }
    const evaluated = await materializeAttendancePeriod({ organizationId: periodFixture.organization.id, actorUserId: periodFixture.actor.id, employeeIds: periodFixture.employees.map((employee) => employee.id), from: '2026-09-07', to: '2026-09-09', asOf: new Date('2026-09-10T00:00:00Z') });
    ok(evaluated.materializedCount === 6, 'explicit period evaluation materializes every employee/date projection after schedule assignment');
    ok(await prisma.dailyAttendanceRecord.count({ where: { organizationId: periodFixture.organization.id } }) === 6, 'period evaluation commits all DailyAttendanceRecord rows');
    ok(await prisma.dailyAttendanceRecord.count({ where: { organizationId: periodFixture.organization.id, scheduleAssignmentId: { not: null } } }) === 6, 'materialized rows retain their effective schedule snapshots');
  } finally {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('ALTER TABLE "WorkScheduleVersion" DISABLE TRIGGER "WorkScheduleVersion_immutable"');
      await tx.$executeRawUnsafe('ALTER TABLE "WorkScheduleDay" DISABLE TRIGGER "WorkScheduleDay_immutable"');
      await tx.$executeRawUnsafe('ALTER TABLE "WorkScheduleBreak" DISABLE TRIGGER "WorkScheduleBreak_immutable"');
      await tx.dailyAttendanceRecord.deleteMany({ where: { organizationId: periodFixture.organization.id } });
      await tx.employeeScheduleAssignment.deleteMany({ where: { organizationId: periodFixture.organization.id } });
      await tx.workScheduleVersion.deleteMany({ where: { scheduleGroup: { organizationId: periodFixture.organization.id } } });
      await tx.workScheduleGroup.deleteMany({ where: { organizationId: periodFixture.organization.id } });
      await tx.employee.deleteMany({ where: { organizationId: periodFixture.organization.id } });
      await tx.organization.delete({ where: { id: periodFixture.organization.id } });
      await tx.applicant.deleteMany({ where: { id: { in: periodApplicantIds } } });
      await tx.$executeRawUnsafe('ALTER TABLE "WorkScheduleVersion" ENABLE TRIGGER "WorkScheduleVersion_immutable"');
      await tx.$executeRawUnsafe('ALTER TABLE "WorkScheduleDay" ENABLE TRIGGER "WorkScheduleDay_immutable"');
      await tx.$executeRawUnsafe('ALTER TABLE "WorkScheduleBreak" ENABLE TRIGGER "WorkScheduleBreak_immutable"');
    });
  }
  console.log(`H3 Attendance Foundation tests passed: ${assertions} assertions.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
