/* eslint-disable @typescript-eslint/no-require-imports -- Read-only development integration audit; no individual salary values. */
const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const helper = require('./batch0-recovery-environment.cjs');
const config = helper.configuration();
const db = new PrismaClient({ datasources: { db: { url: helper.readOnly(config.direct) } }, log: [] });
async function main() {
  const [state] = await db.$queryRaw`SELECT current_setting('neon.branch_id',true) AS branch, current_setting('neon.endpoint_id',true) AS endpoint, current_setting('default_transaction_read_only') AS read_only, clock_timestamp() AS now`;
  if (config.identity.branchName !== 'workpulse-ess-design' || state.branch !== 'br-damp-fog-azmmxhga' || state.endpoint !== config.identity.endpointId || state.read_only !== 'on') throw Error('UNVERIFIED_DEVELOPMENT_TARGET');
  const organization = await db.organization.findUniqueOrThrow({ where: { slug: 'st-aloysius' }, select: { id: true, name: true, timeZone: true } });
  const policies = await db.organizationPayrollPolicy.findMany({ where: { organizationId: organization.id }, select: { id: true, version: true, status: true, effectiveFrom: true, effectiveTo: true, dailyPayBasis: true, lateDeductionRule: true, lateDeductionParameter: true, absenceDeductionRule: true, absenceDeductionParameter: true, undertimeDeductionRule: true, undertimeDeductionParameter: true, roundingRule: true, createdAt: true, createdBy: { select: { role: true } } }, orderBy: { version: 'desc' } });
  const schedules = await db.workScheduleVersion.findMany({ where: { scheduleGroup: { organizationId: organization.id } }, select: { id: true, version: true, displayName: true, lateGraceSeconds: true, days: { select: { isoWeekday: true, isWorkday: true, expectedStartSecond: true, expectedEndSecond: true, breaks: { select: { startSecond: true, endSecond: true, isPaid: true } } } } } });
  const counts = {
    activeEmployees: await db.employee.count({ where: { organizationId: organization.id, employeeStatus: 'ACTIVE' } }),
    activeCards: await db.rfidCard.count({ where: { organizationId: organization.id, deactivatedAt: null } }),
    rfidEvents: await db.attendanceEvent.count({ where: { organizationId: organization.id, source: 'RFID' } }),
    dailyRecords: await db.dailyAttendanceRecord.count({ where: { organizationId: organization.id } }),
    statutoryInputs: await db.payrollStatutoryInput.count({ where: { organizationId: organization.id } }),
    taxOpenings: await db.payrollTaxOpening.count({ where: { organizationId: organization.id } }),
  };
  const populations = await db.dailyAttendanceRecord.groupBy({ by: ['attendanceStatus'], where: { organizationId: organization.id }, _count: { _all: true } });
  const compensationKinds = await db.employeeCompensation.groupBy({ by: ['compensationType', 'payFrequency', 'currency'], where: { organizationId: organization.id, status: 'ACTIVE' }, _count: { _all: true } });
  const fingerprints = [];
  // Aggregate only: record contents, employee names and individual compensation are never exported.
  for (const table of ['AttendanceEvent', 'DailyAttendanceRecord', 'AttendanceCorrection', 'EmployeeScheduleAssignment', 'WorkScheduleVersion', 'OrganizationPayrollPolicy', 'PayrollEntry', 'PayrollStatutoryPosting']) {
    const [row] = await db.$queryRawUnsafe(`SELECT count(*)::int AS count, md5(coalesce(string_agg(md5(row_to_json(t)::text), '' ORDER BY id), '')) AS fingerprint FROM "public"."${table}" t`);
    fingerprints.push({ table, ...row });
  }
  const result = { capturedAt: state.now, branch: state.branch, endpoint: state.endpoint, readOnly: true, organization, policies, schedules, counts, populations, compensationKinds, fingerprints, originalEnvUnchanged: true };
  helper.assertOriginalUnchanged(config);
  fs.mkdirSync('docs/rfid/integration-audit', { recursive: true });
  const name = process.argv[2] === 'after' ? 'read-only-after' : 'read-only-before';
  if (name === 'read-only-before' && fs.existsSync(`docs/rfid/integration-audit/${name}.json`)) throw Error('AUDIT_BASELINE_EXISTS');
  fs.writeFileSync(`docs/rfid/integration-audit/${name}.json`, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ ...result, schedules: schedules.map(schedule => ({ name: schedule.displayName, version: schedule.version, lateGraceSeconds: schedule.lateGraceSeconds })), fingerprints: fingerprints.map(item => ({ table: item.table, count: item.count })) }, null, 2));
}
main().catch(error => { console.error({ code: error.code || error.name, message: /^[A-Z_]+$/.test(error.message) ? error.message : undefined }); process.exitCode = 1; }).finally(() => db.$disconnect());
