import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { AttendanceStatus, Prisma } from '@prisma/client';
import { prisma } from '../src/lib/db/prisma';
import { createRfidService } from '../src/features/attendance/rfid-service';
import { assignSchedule, correctAttendance, createScheduleVersion, materializeAttendanceDay } from '../src/features/attendance/service';
import { attendanceDateToDb, calculateAttendanceDurations, instantForLocalSecond, summarizeAttendanceIndicators } from '../src/features/attendance/domain';
import { generatePayroll } from '../src/features/payroll/service';
import { createPayrollPolicy } from '../src/features/payroll/policy';
import { assessPayrollPeriod, finalizePayrollPeriod, movePayrollPeriodToReview } from '../src/features/payroll/review';
import { employee, organization, payload, period, setup } from './test-payroll-integration';

assert.match(new URL(process.env.DATABASE_URL!).searchParams.get('schema') ?? '', /^batch3_test_[a-f0-9]{24}$/);
// Sanitized values copied from the audited schedule; no local database evidence is required.
const audit = JSON.parse(fs.readFileSync('scripts/fixtures/rfid-schedule-payroll.json', 'utf8'));
const copiedShift = audit.schedules.find((item: { lateGraceSeconds: number }) => item.lateGraceSeconds === 900);
assert(copiedShift, 'Use the audited SAGA schedule, without inventing grace or deduction rates');
const zone = 'Asia/Manila';
let clock = instantForLocalSecond('2026-09-01', 7 * 3600, zone);
const checks: Array<{ passed: boolean; message: string; detail?: unknown }> = [];
const scenarios: unknown[] = [];
let stage = 'initialization';
const check = (condition: unknown, message: string, detail?: unknown) => { checks.push({ passed: Boolean(condition), message, detail }); console.log(`CHAIN ${condition ? 'PASS' : 'FAIL'} ${checks.length}: ${message}`); };
const forbidden = async (operation: () => Promise<unknown>, code: string) => {
  try { await operation(); return false; } catch (error) { return error instanceof Error && 'code' in error && error.code === code; }
};
const date = attendanceDateToDb;
const at = (day: string, second: number) => { clock = instantForLocalSecond(day, second, zone); };

// Test-only database clock proxy: all card/event/projection/receipt writes still
// use real PostgreSQL transactions. No production clock override is introduced.
const clockDb = new Proxy(prisma, {
  get(target, property) {
    if (property === '$transaction') return (work: (tx: Prisma.TransactionClient) => Promise<unknown>, options: { timeout?: number }) => target.$transaction(tx => work(new Proxy(tx, {
      get(transaction, method) {
        if (method === '$queryRaw') return (query: TemplateStringsArray | Prisma.Sql, ...values: unknown[]) => {
          if (Array.isArray(query) && query.join('').trim() === 'SELECT clock_timestamp() AS now') return Promise.resolve([{ now: new Date(clock) }]);
          return transaction.$queryRaw(query, ...values);
        };
        const value = Reflect.get(transaction, method);
        return typeof value === 'function' ? value.bind(transaction) : value;
      },
    })), options);
    const value = Reflect.get(target, property);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});
const rfid = createRfidService(clockDb, process.env.SESSION_SECRET!);
type Scope = Awaited<ReturnType<typeof organization>>;
type Person = Awaited<ReturnType<typeof employee>>;
type Snapshot = { policy: { id: string; isDefault: boolean; deductionRules: { late: { rule: string; amount: string }; absence: { rule: string; amount: string }; undertime: { rule: string; amount: string } } }; attendanceSummary: { totalRecords: number; scheduledWorkdays: number; presentDays: number; absentDays: number; lateOccurrences: number; lateSeconds: number }; calculation: { attendanceAffectsPay: boolean } };

async function scope() {
  stage = 'fixture organization';
  const context = await organization(prisma);
  await prisma.organization.update({ where: { id: context.organizationId }, data: { timeZone: zone } });
  stage = 'fixture employee';
  const person = await employee(prisma, context);
  const payrollPeriod = await period(prisma, context);
  stage = 'reviewed statutory fixture setup';
  await setup(prisma, context, person, payrollPeriod.id, payload());
  return { context, person, payrollPeriod };
}
async function schedule(context: Scope, person: Person, effectiveFrom = '2026-01-01') {
  stage = 'create schedule version';
  const result = await createScheduleVersion({ ...context, name: 'Isolated copy of audited SAGA 08:00–17:00 schedule', lateGraceSeconds: copiedShift.lateGraceSeconds, days: copiedShift.days });
  stage = 'assign schedule';
  await assignSchedule({ ...context, employeeId: person.id, scheduleVersionId: result.scheduleVersionId, effectiveFrom });
}
async function policy(context: Scope) {
  // No invented monetary parameter: exercise the existing derived-daily-rate
  // option with an explicitly authorized fixture policy; late/undertime are NONE.
  return createPayrollPolicy({ ...context, effectiveFrom: '2026-01-01', dailyPayBasis: 'SCHEDULED_PAYABLE_DAYS', lateDeductionRule: 'NONE', absenceDeductionRule: 'DAILY_RATE_PER_ABSENT_DAY', undertimeDeductionRule: 'NONE', roundingRule: 'STANDARD_2_DECIMAL' });
}
async function row(context: Scope, person: Person, day: string) {
  return prisma.dailyAttendanceRecord.findUniqueOrThrow({ where: { organizationId_employeeId_attendanceDate: { organizationId: context.organizationId, employeeId: person.id, attendanceDate: date(day) } } });
}
async function evaluate(context: Scope, person: Person, asOf = instantForLocalSecond('2026-10-01', 0, zone)) {
  // Batch fixture evaluation in one explicitly bounded transaction. The H3 suite
  // separately covers the public period evaluator; this exercises the identical
  // day calculator without a default five-second fixture transaction deadline.
  return prisma.$transaction(async tx => {
    for (let index = 1; index <= 30; index++) await materializeAttendanceDay(tx, { organizationId: context.organizationId, employeeId: person.id, attendanceDate: `2026-09-${String(index).padStart(2, '0')}`, asOf });
  }, { timeout: 120_000 });
}
async function probePayroll(input: { organizationId: string; actorUserId: string; payrollPeriodId: string }) {
  const rollback = new Error('AUDIT_PAYROLL_PROBE_ROLLBACK');
  let result: Awaited<ReturnType<typeof generatePayroll>> | undefined;
  try { await prisma.$transaction(async tx => { result = await generatePayroll(input, tx); throw rollback; }, { timeout: 120_000 }); }
  catch (error) { if (error !== rollback) throw error; }
  return result!;
}

async function main() {
  if (process.argv.includes('--setup-only')) {
    const fixture = await scope();
    await policy(fixture.context); await schedule(fixture.context, fixture.person, '2026-09-02');
    check(true, 'copied SAGA schedule and reviewed payroll setup complete');
    return;
  }
  check(audit.policies.length === 0, 'Audited fixture has no company-deduction policy; no SAGA rates are invented');
  const days = ['2026-09-01', '2026-09-02', '2026-10-01', '2026-10-02'];
  const twoPerMonth = days.map(attendanceDate => ({ attendanceDate, status: AttendanceStatus.PRESENT, lateSeconds: 60 }));
  check(!summarizeAttendanceIndicators(twoPerMonth).habitualTardinessReview, 'two September plus two October late days do not meet four in one month');
  check(!summarizeAttendanceIndicators(twoPerMonth.slice(0, 3)).habitualTardinessReview, 'three occurrences do not meet the habitual threshold');

  const main = await scope();
  await schedule(main.context, main.person);
  const storedPolicy = await policy(main.context);
  const cardNumber = '0000900001';
  await rfid.enroll(main.context, { employeeId: main.person.id, cardNumber, expectedCardId: null });
  for (const [day, timeInSecond, timeOutSecond, lateSeconds, undertimeSeconds, workedSeconds] of [
    ['2026-09-01', 28800, 61200, 0, 0, 28800],
    ['2026-09-02', 29700, 61200, 0, 0, 27900],
    ['2026-09-03', 30000, 59400, 300, 1800, 25800],
    ['2026-09-04', 29760, 61200, 60, 0, 27840],
    ['2026-09-07', 29820, 61200, 120, 0, 27780],
    ['2026-09-08', 29880, 61200, 180, 0, 27720],
  ] as const) {
    at(day, timeInSecond);
    const kiosk = await rfid.authorizeKiosk(main.context), requestId = randomUUID();
    const recorded = await rfid.scan(main.context.organizationId, kiosk.token, { cardNumber, requestId });
    check(recorded.code === 'RECORDED' && recorded.direction === 'TIME_IN' && recorded.timeZone === zone, `${day} RFID chooses server-time Time In in Asia/Manila`);
    if (day === '2026-09-01') {
      const retry = await rfid.scan(main.context.organizationId, kiosk.token, { cardNumber, requestId });
      clock = new Date(clock.getTime() + 1000);
      const duplicate = await rfid.scan(main.context.organizationId, kiosk.token, { cardNumber, requestId: randomUUID() });
      check(retry.occurredAt === recorded.occurredAt && duplicate.code === 'DUPLICATE_SCAN', 'same-UUID replay and rapid new-UUID scan do not switch direction');
      check(await prisma.attendanceEvent.count({ where: { organizationId: main.context.organizationId, employeeId: main.person.id } }) === 1, 'duplicate RFID inputs preserve one Time In event');
    }
    at(day, timeOutSecond);
    const outKiosk = await rfid.authorizeKiosk(main.context);
    const out = await rfid.scan(main.context.organizationId, outKiosk.token, { cardNumber, requestId: randomUUID() });
    const projected = await row(main.context, main.person, day);
    check(out.direction === 'TIME_OUT' && projected.attendanceStatus === 'PRESENT', `${day} RFID pair materializes attendance through the existing schedule`);
    check(projected.lateSeconds === lateSeconds && projected.undertimeSeconds === undertimeSeconds && projected.workedSeconds === workedSeconds && projected.lateGraceSeconds === 900, `${day} exact lateness, grace, undertime and unpaid break are correct`, { actualLate: projected.lateSeconds, actualUndertime: projected.undertimeSeconds, actualWorked: projected.workedSeconds });
    scenarios.push({ day, in: recorded.occurredAt, out: out.occurredAt, lateSeconds: projected.lateSeconds, undertimeSeconds: projected.undertimeSeconds, workedSeconds: projected.workedSeconds });
  }
  const zeroGrace = calculateAttendanceDurations({ attendanceDate: '2026-09-03', timeZone: zone, scheduledStartAt: instantForLocalSecond('2026-09-03', 28800, zone), scheduledEndAt: instantForLocalSecond('2026-09-03', 61200, zone), lateGraceSeconds: 0, breaks: [], firstTimeIn: instantForLocalSecond('2026-09-03', 30000, zone), lastTimeOut: instantForLocalSecond('2026-09-03', 63000, zone) });
  check(zeroGrace.lateSeconds === 1200 && zeroGrace.overtimeSeconds === 1800, 'zero grace counts 20 late minutes and records overtime without inventing overtime pay');
  await prisma.$transaction(tx => materializeAttendanceDay(tx, { organizationId: main.context.organizationId, employeeId: main.person.id, attendanceDate: '2026-09-09', asOf: instantForLocalSecond('2026-09-09', 61199, zone) }), { timeout: 30_000 });
  check((await row(main.context, main.person, '2026-09-09')).attendanceStatus === 'OPEN', 'no-scan workday is not marked absent before schedule end');
  await evaluate(main.context, main.person);
  check((await row(main.context, main.person, '2026-09-09')).attendanceStatus === 'ABSENT', 'no-scan workday becomes absent after schedule end');
  check((await row(main.context, main.person, '2026-09-05')).attendanceStatus === 'REST_DAY', 'scheduled rest day is not an absence');
  const rows = await prisma.dailyAttendanceRecord.findMany({ where: { organizationId: main.context.organizationId, employeeId: main.person.id }, orderBy: { attendanceDate: 'asc' } });
  const indicators = summarizeAttendanceIndicators(rows.map(item => ({ attendanceDate: item.attendanceDate.toISOString().slice(0, 10), status: item.attendanceStatus, disposition: item.disposition, lateSeconds: item.lateSeconds })));
  check(indicators.tardinessCount === 4 && indicators.habitualTardinessReview, 'four late occurrences in September trigger SAGA HR review only');
  const generated = await generatePayroll({ ...main.context, payrollPeriodId: main.payrollPeriod.id });
  check(generated.createdCount === 1 && generated.setupErrors.length === 0, 'RFID → assigned schedule → evaluated month → reviewed statutory payroll succeeds', generated.setupErrors);
  const entry = await prisma.payrollEntry.findFirstOrThrow({ where: { organizationId: main.context.organizationId } });
  const snapshot = entry.calculationSnapshot as unknown as Snapshot;
  check(snapshot.attendanceSummary.totalRecords === 30 && snapshot.attendanceSummary.scheduledWorkdays === 22 && snapshot.attendanceSummary.presentDays === 6 && snapshot.attendanceSummary.absentDays === 16 && snapshot.attendanceSummary.lateOccurrences === 4 && snapshot.attendanceSummary.lateSeconds === 660, 'payroll reads the exact materialized daily totals, including 11 late minutes');
  const expectedAbsence = main.person.compensation.baseRate.div(22).mul(16).toDecimalPlaces(2).toFixed(2);
  check(snapshot.policy.id === storedPolicy.id && snapshot.policy.deductionRules.absence.amount === expectedAbsence && snapshot.policy.deductionRules.late.amount === '0.00' && snapshot.policy.deductionRules.undertime.amount === '0.00', 'only the authorized fixture policy applies; absence uses its derived daily rate and NONE rules charge zero');
  await movePayrollPeriodToReview({ ...main.context, payrollPeriodId: main.payrollPeriod.id });
  check((await assessPayrollPeriod(main.context.organizationId, main.payrollPeriod.id)).canFinalize, 'unchanged attendance and policy can pass payroll review');
  const absent = await row(main.context, main.person, '2026-09-09');
  await correctAttendance({ ...main.context, dailyAttendanceRecordId: absent.id, expectedRevision: 0, correctedTimeIn: instantForLocalSecond('2026-09-09', 28800, zone), correctedTimeOut: instantForLocalSecond('2026-09-09', 61200, zone), correctedStatus: 'PRESENT', reason: 'Isolated audit fixture: verified missing-reader attendance' });
  const stale = await assessPayrollPeriod(main.context.organizationId, main.payrollPeriod.id);
  check(!stale.canFinalize && stale.issues.some(item => /attendance/i.test(item.message)), 'payroll review rejects changed daily attendance instead of finalizing stale deductions', stale.issues);
  check(await forbidden(() => finalizePayrollPeriod({ ...main.context, payrollPeriodId: main.payrollPeriod.id, confirmation: 'FINALIZE' }), 'SETUP_REQUIRED'), 'stale attendance blocks finalization without changing the existing entry');

  stage = 'missing-schedule scenario';
  const missing = await scope();
  await policy(missing.context);
  await schedule(missing.context, missing.person, '2026-09-02');
  at('2026-09-01', 30000);
  await rfid.enroll(missing.context, { employeeId: missing.person.id, cardNumber: '0000900002', expectedCardId: null });
  const mk = await rfid.authorizeKiosk(missing.context);
  const missingScan = await rfid.scan(missing.context.organizationId, mk.token, { cardNumber: '0000900002', requestId: randomUUID() });
  await evaluate(missing.context, missing.person);
  // A one-day schedule gap must not disappear just because the rest of the
  // period is configured. Verified fixture corrections keep net pay positive,
  // so unrelated deduction-limit validation cannot mask the missing schedule.
  for (const day of ['2026-09-02', '2026-09-03', '2026-09-04', '2026-09-07']) {
    const item = await row(missing.context, missing.person, day);
    await correctAttendance({ ...missing.context, dailyAttendanceRecordId: item.id, expectedRevision: 0, correctedTimeIn: instantForLocalSecond(day, 28800, zone), correctedTimeOut: instantForLocalSecond(day, 61200, zone), correctedStatus: 'PRESENT', reason: 'Isolated audit fixture: verified complete attendance' });
  }
  const noSchedule = await row(missing.context, missing.person, '2026-09-01');
  check(missingScan.code === 'RECORDED' && noSchedule.attendanceStatus === 'NO_SCHEDULE' && noSchedule.lateSeconds === null, 'missing schedule retains RFID evidence but never invents lateness or absence');
  const missingResult = await probePayroll({ ...missing.context, payrollPeriodId: missing.payrollPeriod.id });
  check(missingResult.createdCount === 0 && missingResult.setupErrors.some(item => /schedule/i.test(item.message)), 'attendance-based payroll is blocked on NO_SCHEDULE records', missingResult);

  const unresolved = await scope();
  await schedule(unresolved.context, unresolved.person); await policy(unresolved.context);
  at('2026-09-01', 30000);
  await rfid.enroll(unresolved.context, { employeeId: unresolved.person.id, cardNumber: '0000900003', expectedCardId: null });
  const uk = await rfid.authorizeKiosk(unresolved.context);
  await rfid.scan(unresolved.context.organizationId, uk.token, { cardNumber: '0000900003', requestId: randomUUID() });
  await evaluate(unresolved.context, unresolved.person, instantForLocalSecond('2026-09-01', 43200, zone));
  const openResult = await probePayroll({ ...unresolved.context, payrollPeriodId: unresolved.payrollPeriod.id });
  check(openResult.createdCount === 0 && openResult.setupErrors.some(item => /open|unresolved/i.test(item.message)), 'attendance-based payroll rejects OPEN/future workdays', openResult);
  await evaluate(unresolved.context, unresolved.person);
  check((await row(unresolved.context, unresolved.person, '2026-09-01')).attendanceStatus === 'INCOMPLETE', 'missing Time Out becomes INCOMPLETE after day end');
  const incomplete = await probePayroll({ ...unresolved.context, payrollPeriodId: unresolved.payrollPeriod.id });
  check(incomplete.createdCount === 0 && incomplete.setupErrors.some(item => /incomplete|unresolved/i.test(item.message)), 'attendance-based payroll rejects INCOMPLETE RFID days', incomplete);

  const defaults = await scope();
  const defaultGenerated = await generatePayroll({ ...defaults.context, payrollPeriodId: defaults.payrollPeriod.id });
  const defaultEntry = await prisma.payrollEntry.findFirstOrThrow({ where: { organizationId: defaults.context.organizationId } });
  const defaultSnapshot = defaultEntry.calculationSnapshot as unknown as Snapshot;
  check(defaultGenerated.createdCount === 1 && defaultSnapshot.policy.id === 'DEFAULT' && Object.values(defaultSnapshot.policy.deductionRules).every(item => item.rule === 'NONE' && item.amount === '0.00'), 'no configured policy means zero company deductions, not invented SAGA rates');
  check(await forbidden(() => createPayrollPolicy({ ...defaults.context, effectiveFrom: '2026-01-01', dailyPayBasis: 'SCHEDULED_PAYABLE_DAYS', lateDeductionRule: 'PER_MINUTE', absenceDeductionRule: 'NONE', undertimeDeductionRule: 'NONE', roundingRule: 'STANDARD_2_DECIMAL' }), 'INVALID_PARAMETER'), 'missing monetary rate is rejected rather than invented');
  const missingSetup = await scope();
  await prisma.payrollStatutoryInput.deleteMany({ where: { organizationId: missingSetup.context.organizationId } });
  const setupResult = await generatePayroll({ ...missingSetup.context, payrollPeriodId: missingSetup.payrollPeriod.id });
  check(setupResult.createdCount === 0 && setupResult.setupErrors.some(item => /statutory|verified/i.test(item.message)), 'legacy-style fixture without statutory setup fails with SETUP_REQUIRED');
  scenarios.push({ payroll: { summary: snapshot.attendanceSummary, configuredRule: 'DAILY_RATE_PER_ABSENT_DAY', derivedAbsenceAmount: expectedAbsence, lateRule: 'NONE', undertimeRule: 'NONE', source: 'Synthetic authorized policy only; no SAGA policy or rate created' } });
  const failures = checks.filter(item => !item.passed);
  fs.mkdirSync('docs/rfid/integration-audit', { recursive: true });
  fs.writeFileSync('docs/rfid/integration-audit/scenarios.json', JSON.stringify({ capturedAt: new Date().toISOString(), isolatedSchema: true, testClockOnly: true, assertions: checks.length, failed: failures.length, checks, scenarios }, null, 2) + '\n');
  assert.equal(failures.length, 0, failures.map(item => item.message).join('; '));
}
main().catch(error => { console.error(JSON.stringify({ code: error.code || error.name, stage, message: String(error.message).replace(/postgres(?:ql)?:\/\/\S+/gi, '[REDACTED]').replace(/[a-f0-9]{64}/g, '[DIGEST]') })); process.exitCode = 1; }).finally(() => prisma.$disconnect());
