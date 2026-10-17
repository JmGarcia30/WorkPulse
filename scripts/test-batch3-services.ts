import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

assert.match(new URL(process.env.DATABASE_URL!).searchParams.get('schema') ?? '', /^batch3_test_[a-f0-9]{24}$/);
const db = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
(globalThis as unknown as { prisma: PrismaClient }).prisma = db;
let count = 0, checks = 0;
let phase = 'setup';
db.$on('query', () => count++);
const day = (s: string) => new Date(s + 'T00:00:00.000Z');
const samples: unknown[] = [];
const ok = (v: unknown, message: string) => { assert.ok(v, message); console.log(`PASS ${++checks}: ${message}`); };
const normalize = (v: unknown) => JSON.stringify(v, function (key, value) {
  if (['createdAt', 'updatedAt', 'calculatedAt'].includes(key)) return undefined;
  if (key === 'id' && this.payrollPeriodId && this.baseAmount) return undefined;
  return value;
});
async function timed(operation: () => Promise<unknown>) {
  const before = count, start = performance.now(); const value = await operation();
  return { value, ms: performance.now() - start, sql: count - before };
}
async function fixture(size: number) {
  const organization = await db.organization.create({ data: { name: 'Synthetic Batch 3', slug: 'batch3-' + randomUUID(), timeZone: 'Asia/Manila' } });
  const actor = await db.user.create({ data: { organizationId: organization.id, name: 'Synthetic HR', email: randomUUID() + '@fixture.invalid', role: 'HR_ADMIN' } });
  const job = await db.job.create({ data: { organizationId: organization.id, title: 'Synthetic', slug: 'synthetic', department: 'Test', employmentType: 'Full-time', location: 'Test', description: 'Test', responsibilities: 'Test', qualifications: 'Test', requirements: 'Test' } });
  const rows = Array.from({ length: size }, (_, i) => ({ id: randomUUID(), applicant: randomUUID(), application: randomUUID(), employment: randomUUID(), compensation: randomUUID(), number: 'SYN-' + String(i).padStart(4, '0') }));
  await db.applicant.createMany({ data: rows.map(r => ({ id: r.applicant, firstName: r.number, lastName: 'Fixture', email: r.applicant + '@fixture.invalid', phone: '0' })) });
  await db.application.createMany({ data: rows.map(r => ({ id: r.application, jobId: job.id, applicantId: r.applicant, status: 'HIRED', coverLetter: 'Synthetic' })) });
  await db.employee.createMany({ data: rows.map(r => ({ id: r.id, organizationId: organization.id, applicantId: r.applicant, sourceApplicationId: r.application, employeeNumber: r.number, firstName: r.number, lastName: 'Fixture', email: r.id + '@fixture.invalid', phone: '0', createdById: actor.id })) });
  await db.employmentRecord.createMany({ data: rows.map(r => ({ id: r.employment, employeeId: r.id, jobTitle: 'Synthetic', department: 'Test', employmentCategory: 'NON_TEACHING', employmentType: 'Full-time', hireDate: day('2026-01-01'), startDate: day('2026-01-01'), salary: 1, payFrequency: 'MONTHLY', employmentStatus: 'REGULAR', effectiveFrom: day('2026-01-01'), createdById: actor.id })) });
  await db.employeeCompensation.createMany({ data: rows.map((r, i) => ({ id: r.compensation, organizationId: organization.id, employeeId: r.id, compensationType: i % 2 ? 'DAILY' : 'MONTHLY', baseRate: i % 2 ? '123.45' : '12345.67', payFrequency: 'MONTHLY', effectiveFrom: day('2026-01-01') })) });
  const period = await db.payrollPeriod.create({ data: { organizationId: organization.id, name: 'Synthetic October', periodStart: day('2026-10-01'), periodEnd: day('2026-10-31'), payDate: day('2026-10-31') } });
  await db.dailyAttendanceRecord.createMany({ data: rows.flatMap((r, i) => Array.from({ length: 31 }, (_, j) => ({ organizationId: organization.id, employeeId: r.id, employmentRecordId: r.employment, attendanceDate: day('2026-10-' + String(j + 1).padStart(2, '0')), timeZoneSnapshot: 'Asia/Manila', attendanceStatus: (j % 7 === 6 ? 'REST_DAY' : j % 11 === 0 ? 'INCOMPLETE' : j % 5 === 0 ? 'ABSENT' : 'PRESENT') as 'PRESENT', lateSeconds: i % 2 ? 120 : 0, undertimeSeconds: j % 3 ? 0 : 60, lastCalculatedAt: day('2026-11-01') }))) });
  return { organization, actor, rows, period };
}
async function main() {
  const { generatePayroll } = await import('../src/features/payroll/service');
  const { generatePayroll: legacyGenerate } = await import('./reference/batch3-payroll-service');
  const { materializeAttendancePeriod } = await import('../src/features/attendance/service');
  const { materializeAttendancePeriod: legacyPeriod } = await import('./reference/batch3-attendance');
  if (process.env.WORKPULSE_BATCH3_SCENARIOS_ONLY === '1') {
    const f = await fixture(5);
    const input = { organizationId: f.organization.id, actorUserId: f.actor.id, payrollPeriodId: f.period.id };
    phase = 'leave-type';
    const leaveType = await db.leaveType.create({ data: { organizationId: f.organization.id, code: 'PARITY', name: 'Synthetic Leave', isPaid: true, countingMode: 'SCHEDULED_WORK_DAYS', policyReference: 'Synthetic parity fixture' } });
    const request = await db.leaveRequest.create({ data: { organizationId: f.organization.id, employeeId: f.rows[1].id, leaveTypeId: leaveType.id, requestedStartDate: day('2026-10-05'), requestedEndDate: day('2026-10-05'), requestedUnits: '1.0000', calculationFinalizedAt: day('2026-10-01'), reason: 'Synthetic', status: 'APPROVED', policySnapshot: {}, leaveTypeCodeSnapshot: leaveType.code, leaveTypeNameSnapshot: leaveType.name, leavePaidSnapshot: true, countingModeSnapshot: 'SCHEDULED_WORK_DAYS' } });
    phase = 'leave-day';
    await db.leaveRequestDay.create({ data: { organizationId: f.organization.id, employeeId: f.rows[1].id, leaveRequestId: request.id, attendanceDate: day('2026-10-05'), employmentRecordId: f.rows[1].employment, isScheduledWorkday: true, chargeUnits: '1.0000', leaveSeconds: 14400, employmentSnapshot: {} } });
    phase = 'leave-disposition';
    await db.dailyAttendanceRecord.updateMany({ where: { employeeId: f.rows[1].id, attendanceDate: day('2026-10-05') }, data: { disposition: 'APPROVED_LEAVE' } });
    phase = 'policy';
    const policy = await db.organizationPayrollPolicy.create({ data: { organizationId: f.organization.id, version: 1, effectiveFrom: day('2026-01-01'), dailyPayBasis: 'PRESENT_PLUS_PAID_LEAVE', lateDeductionRule: 'PER_MINUTE', lateDeductionParameter: '1.2345', absenceDeductionRule: 'DAILY_RATE_PER_ABSENT_DAY', undertimeDeductionRule: 'PER_MINUTE', undertimeDeductionParameter: '0.4321', createdById: f.actor.id, leaveTreatments: { create: { organizationId: f.organization.id, leaveTypeId: leaveType.id, treatment: 'PAID' } } } });
    async function parity(label: string) {
      phase = label;
      const results = [];
      for (const generate of [legacyGenerate, generatePayroll]) {
        await db.payrollEntry.deleteMany({ where: { payrollPeriodId: f.period.id } });
        const result = await generate(input, db);
        results.push({ result, entries: await db.payrollEntry.findMany({ where: { payrollPeriodId: f.period.id }, orderBy: { employeeId: 'asc' } }) });
      }
      ok(normalize(results[0]) === normalize(results[1]), label);
    }
    await parity('Custom policy: fractional Decimal deductions, paid leave, daily/monthly rates and complete snapshots');
    for (const treatment of ['UNPAID', 'NO_PAYROLL_EFFECT'] as const) {
      await db.payrollPolicyLeaveTreatment.updateMany({ where: { payrollPolicyId: policy.id }, data: { treatment } });
      await db.organizationPayrollPolicy.update({ where: { id: policy.id }, data: { dailyPayBasis: 'ACTUAL_PRESENT_DAYS', lateDeductionRule: 'FIXED_PER_OCCURRENCE', absenceDeductionRule: 'FIXED_PER_ABSENCE', absenceDeductionParameter: '12.3456', undertimeDeductionRule: 'FIXED_PER_OCCURRENCE' } });
      await parity(`Custom policy: ${treatment}, actual-present basis and occurrence deductions`);
    }
    await db.organizationPayrollPolicy.update({ where: { id: policy.id }, data: { lateDeductionParameter: '999999.0000' } });
    await parity('Deduction-exceeds-gross setup errors and unaffected employees match');
    await db.employeeCompensation.create({ data: { organizationId: f.organization.id, employeeId: f.rows[0].id, compensationType: 'MONTHLY', baseRate: '12345.67', payFrequency: 'MONTHLY', effectiveFrom: day('2026-01-01') } });
    await parity('Multiple covering compensations produce identical setup errors');
    await db.payrollEntry.deleteMany({ where: { payrollPeriodId: f.period.id } });
    const concurrent = await Promise.all([generatePayroll(input, db), generatePayroll(input, db)]);
    const entries = await db.payrollEntry.findMany({ where: { payrollPeriodId: f.period.id } });
    ok(concurrent.reduce((n, r) => n + r.createdCount, 0) === entries.length && new Set(entries.map(e => e.employeeId)).size === entries.length, 'Concurrent generation creates at most one entry per employee');
    const other = await fixture(1);
    await assert.rejects(() => generatePayroll({ ...input, actorUserId: other.actor.id }, db), (e: unknown) => e instanceof Error && 'code' in e && e.code === 'FORBIDDEN');
    ok(true, 'Foreign tenant actor cannot generate this period');
    return;
  }
  for (const size of [5, 50, 100]) {
    const f = await fixture(size);
    const input = { organizationId: f.organization.id, actorUserId: f.actor.id, payrollPeriodId: f.period.id };
    for (let iteration = 0; iteration < 4; iteration++) {
      const results = new Map();
      for (const mode of (iteration % 2 ? ['after', 'before'] : ['before', 'after'])) {
        await db.payrollEntry.deleteMany({ where: { organizationId: f.organization.id, payrollPeriodId: f.period.id } });
        const result = await timed(() => mode === 'before' ? legacyGenerate(input, db) : generatePayroll(input, db));
        const entries = await db.payrollEntry.findMany({ where: { payrollPeriodId: f.period.id }, orderBy: { employeeId: 'asc' } });
        results.set(mode, { result: result.value, entries });
        samples.push({ workload: 'payroll-generation', size, iteration, mode, ms: result.ms, sql: result.sql });
        writeFileSync('docs/performance-audit/batch-3/service-samples.json', JSON.stringify(samples, null, 2));
      }
      ok(normalize(results.get('before')) === normalize(results.get('after')), `Full payroll calculation and snapshot parity: ${size} employees, sample ${iteration}`);
    }
    const before = await db.payrollEntry.findMany({ where: { payrollPeriodId: f.period.id }, orderBy: { employeeId: 'asc' } });
    const again = await generatePayroll(input, db);
    ok(again.createdCount === 0 && again.existingCount === size, `Idempotent generation: ${size} employees`);
    ok(JSON.stringify(before) === JSON.stringify(await db.payrollEntry.findMany({ where: { payrollPeriodId: f.period.id }, orderBy: { employeeId: 'asc' } })), 'Existing immutable entries unchanged');
    if (size === 5) {
      // Compare setup errors at effective-date boundaries and missing required attendance.
      await db.payrollEntry.deleteMany({ where: { payrollPeriodId: f.period.id } });
      await db.employeeCompensation.update({ where: { id: f.rows[0].compensation }, data: { effectiveTo: day('2026-10-30') } });
      await db.dailyAttendanceRecord.deleteMany({ where: { employeeId: f.rows[1].id, attendanceDate: day('2026-10-31') } });
      const old = await legacyGenerate(input, db);
      await db.payrollEntry.deleteMany({ where: { payrollPeriodId: f.period.id } });
      const current = await generatePayroll(input, db);
      ok(JSON.stringify(old) === JSON.stringify(current) && current.setupErrors.length === 2, 'Missing attendance and partial-period compensation errors match');
      await db.payrollPeriod.update({ where: { id: f.period.id }, data: { status: 'FINALIZED', finalizedAt: new Date(), finalizedById: f.actor.id } });
      for (const generate of [legacyGenerate, generatePayroll]) {
        await assert.rejects(() => generate(input, db), (e: unknown) => e instanceof Error && 'code' in e && e.code === 'FINALIZED');
      }
      ok(true, 'Both implementations reject finalized period generation');
    }
  }
  const f = await fixture(3);
  const group = await db.workScheduleGroup.create({ data: { organizationId: f.organization.id, scheduleKey: 'fixture', name: 'Fixture', createdById: f.actor.id } });
  const version = await db.workScheduleVersion.create({ data: { scheduleGroupId: group.id, version: 1, displayName: 'Fixture', createdById: f.actor.id, days: { create: Array.from({ length: 7 }, (_, i) => ({ isoWeekday: i + 1, isWorkday: i < 5, expectedStartSecond: i < 5 ? 28800 : null, expectedEndSecond: i < 5 ? 61200 : null, breaks: i < 5 ? { create: [{ startSecond: 43200, endSecond: 46800, isPaid: false }] } : undefined })) } } });
  await db.employeeScheduleAssignment.createMany({ data: f.rows.map(r => ({ organizationId: f.organization.id, employeeId: r.id, scheduleVersionId: version.id, effectiveFrom: day('2026-01-01'), createdById: f.actor.id })) });
  await db.attendanceEvent.createMany({ data: f.rows.flatMap(r => [{ organizationId: f.organization.id, employeeId: r.id, occurredAt: new Date('2026-09-09T00:05:00Z'), direction: 'TIME_IN' as const, source: 'MANUAL' as const, sourceReference: r.id + '-in', createdById: f.actor.id }, { organizationId: f.organization.id, employeeId: r.id, occurredAt: new Date('2026-09-09T08:30:00Z'), direction: 'TIME_OUT' as const, source: 'MANUAL' as const, sourceReference: r.id + '-out', createdById: f.actor.id }]) });
  const input = { organizationId: f.organization.id, actorUserId: f.actor.id, employeeIds: f.rows.map(r => r.id), from: '2026-09-09', to: '2026-09-11', asOf: day('2026-09-12') };
  for (let iteration = 0; iteration < 4; iteration++) {
    const results = new Map();
    for (const mode of (iteration % 2 ? ['after', 'before'] : ['before', 'after'])) {
      const result = await timed(() => mode === 'before' ? legacyPeriod(input) : materializeAttendancePeriod(input));
      results.set(mode, { result: result.value, rows: await db.dailyAttendanceRecord.findMany({ where: { organizationId: f.organization.id, attendanceDate: { lt: day('2026-10-01') } }, orderBy: [{ employeeId: 'asc' }, { attendanceDate: 'asc' }] }) });
      samples.push({ workload: 'attendance-period', employees: 3, days: 3, iteration, mode, ms: result.ms, sql: result.sql });
      writeFileSync('docs/performance-audit/batch-3/service-samples.json', JSON.stringify(samples, null, 2));
    }
    ok(normalize(results.get('before')) === normalize(results.get('after')), `Attendance complete projection parity: sample ${iteration}`);
  }
  ok(true, 'All timings exclude fixture setup and comparison queries');
}
main().catch(e => {
  const validation = String(e.message).match(/Argument `\w+` is missing|Unknown argument `\w+`|Expected \w+, provided \w+/g);
  console.error(JSON.stringify({ code: e.code || e.name, phase, message: e instanceof assert.AssertionError ? e.message : undefined, validation }));
  process.exitCode = 1;
}).finally(() => db.$disconnect());
