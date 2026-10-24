import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Prisma, type PrismaClient } from '@prisma/client';
import { organization, employee, period, setup, payload } from './test-payroll-integration';
import { generatePayroll } from '../src/features/payroll/service';
import { movePayrollPeriodToReview, finalizePayrollPeriod } from '../src/features/payroll/review';
import { savePayrollStatutoryInput } from '../src/features/payroll/statutory-inputs';

export async function runPayrollPhase3(db: PrismaClient) {
  let assertions = 0;
  const check = (value: unknown, label: string) => { assert(value, label); assertions++; console.log(`PHASE3 PASS ${assertions}: ${label}`); };
  const rollback = new Error('PHASE3_ROLLBACK');
  const evidence: Record<string, unknown> = {};
  try { await db.$transaction(async tx => {
    const saga = await tx.organization.findUnique({ where: { slug: 'st-aloysius' }, select: { id: true, name: true } });
    if (saga) {
      const policies = await tx.organizationPayrollPolicy.findMany({ where: { organizationId: saga.id }, select: { version: true, effectiveFrom: true, effectiveTo: true, status: true, dailyPayBasis: true, lateDeductionRule: true, lateDeductionParameter: true, absenceDeductionRule: true, absenceDeductionParameter: true, undertimeDeductionRule: true, undertimeDeductionParameter: true, roundingRule: true } });
      const compensationKinds = await tx.employeeCompensation.groupBy({ by: ['compensationType', 'payFrequency', 'currency'], where: { organizationId: saga.id, status: 'ACTIVE' }, _count: { _all: true } });
      evidence.sagaReadOnly = { policies, compensationKinds, personalSalaryAmountsRead: false };
    }
    const scope = await organization(tx), person = await employee(tx, scope), p = await period(tx, scope);
    await setup(tx, scope, person, p.id);
    const type = await tx.leaveType.create({ data: { organizationId: scope.organizationId, code: 'PHASE3-STUDY', name: 'Synthetic unpaid study leave', isPaid: false, countingMode: 'SCHEDULED_WORK_DAYS', policyReference: 'Phase 3 fixture: explicitly unpaid' } });
    const request = await tx.leaveRequest.create({ data: { organizationId: scope.organizationId, employeeId: person.id, leaveTypeId: type.id, requestedStartDate: new Date('2026-09-07Z'), requestedEndDate: new Date('2026-09-07Z'), requestedUnits: '1', calculationFinalizedAt: new Date(), reason: 'Verified synthetic unpaid leave', status: 'APPROVED', policySnapshot: {}, leaveTypeCodeSnapshot: type.code, leaveTypeNameSnapshot: type.name, leavePaidSnapshot: false, countingModeSnapshot: 'SCHEDULED_WORK_DAYS' } });
    await tx.leaveRequestDay.create({ data: { organizationId: scope.organizationId, employeeId: person.id, leaveRequestId: request.id, attendanceDate: new Date('2026-09-07Z'), employmentRecordId: person.employment.id, isScheduledWorkday: true, chargeUnits: '1', employmentSnapshot: { verifiedSynthetic: true } } });
    const result = await generatePayroll({ ...scope, payrollPeriodId: p.id }, tx);
    const observed = await tx.payrollEntry.findFirst({ where: { organizationId: scope.organizationId } });
    fs.mkdirSync('docs/payroll-phase-3', { recursive: true });
    fs.writeFileSync('docs/payroll-phase-3/unpaid-leave-probe.json', JSON.stringify({ createdCount: result.createdCount, setupErrors: result.setupErrors.map(item => item.message), gross: observed?.grossAmount.toFixed(2), net: observed?.netAmount.toFixed(2), leaveSummary: (observed?.calculationSnapshot as Prisma.JsonObject | undefined)?.leaveSummary }, null, 2));
    check(result.createdCount === 0 && result.setupErrors.some(item => /unpaid leave/i.test(item.message)), 'unresolved monthly unpaid leave blocks rather than paying full salary');

    // Reclassify only the disposable fixture to paid leave and verify ordinary leave proceeds.
    await tx.leaveRequest.update({ where: { id: request.id }, data: { leavePaidSnapshot: true } });
    const paid = await generatePayroll({ ...scope, payrollPeriodId: p.id }, tx);
    check(paid.createdCount === 1, 'supported paid leave allows ordinary monthly payroll');
    const entry = await tx.payrollEntry.findFirstOrThrow({ where: { organizationId: scope.organizationId } });
    check(entry.netAmount.eq('30473.70') && (entry.calculationSnapshot as Prisma.JsonObject).leaveSummary !== undefined, 'paid leave preserves correct statutory net and leave summary');
    // Represent a pre-fix unfinalized draft, without touching any real or finalized record.
    const snapshot = entry.calculationSnapshot as Prisma.JsonObject;
    await tx.payrollEntry.update({ where: { id: entry.id }, data: { calculationSnapshot: { ...snapshot, leaveSummary: { ...(snapshot.leaveSummary as Prisma.JsonObject), unpaidDays: 1 } } } });
    await movePayrollPeriodToReview({ ...scope, payrollPeriodId: p.id }, tx);
    await assert.rejects(() => finalizePayrollPeriod({ ...scope, payrollPeriodId: p.id, confirmation: 'FINALIZE' }, tx), error => error instanceof Error && 'code' in error && error.code === 'SETUP_REQUIRED'); assertions++;

    const rounded = await organization(tx), re = await employee(tx, rounded), rp = await period(tx, rounded);
    const ordinary = payload(); ordinary.monthlyPagIbigFundSalary = '35000.01';
    await setup(tx, rounded, re, rp.id, ordinary);
    const generated = await generatePayroll({ ...rounded, payrollPeriodId: rp.id }, tx);
    check(generated.createdCount === 1, 'ordinary monthly Fund Salary above 10,000 cap is unaffected by unresolved fractional-centavo rounding');
    const allocated = await tx.payrollContributionAllocation.findFirstOrThrow({ where: { posting: { organizationId: rounded.organizationId }, agency: 'PAGIBIG' } });
    check((allocated.allocation as Prisma.JsonObject).employee === '200', 'ordinary capped Pag-IBIG employee amount is exactly 200');
    evidence.ordinarySaga = { syntheticMonthlyBasic: '35000.00', monthlyFundSalary: '35000.01', employeePagIbig: '200.00', roundingBlocks: false };
    const unsupported = await organization(tx), ue = await employee(tx, unsupported), up = await period(tx, unsupported);
    await setup(tx, unsupported, ue, up.id, { ...payload(), monthlyPagIbigFundSalary: '1500.01' });
    const blocked = await generatePayroll({ ...unsupported, payrollPeriodId: up.id }, tx);
    check(blocked.createdCount === 0 && blocked.setupErrors.some(item => item.message.includes('ROUNDING_UNVERIFIED')), 'fractional-centavo Pag-IBIG case stays blocked without an invented rule');
    await savePayrollStatutoryInput({ ...unsupported, employeeId: ue.id, payrollPeriodId: up.id, payload: payload(), evidenceReference: 'corrected fixture verified basis' }, tx);
    await tx.employeeCompensation.update({ where: { id: ue.compensation.id }, data: { compensationType: 'DAILY' } });
    check((await generatePayroll({ ...unsupported, payrollPeriodId: up.id }, tx)).setupErrors.length > 0, 'daily/unsupported arrangement produces setup issues rather than silent zero deductions');
    const semi = await organization(tx), se = await employee(tx, semi, 'SEMI_MONTHLY', '30000');
    const first = await period(tx, semi, '2026-09-01', '2026-09-15'), second = await period(tx, semi, '2026-09-16', '2026-09-30');
    await setup(tx, semi, se, first.id, payload('30000'));
    await generatePayroll({ ...semi, payrollPeriodId: first.id }, tx);
    await movePayrollPeriodToReview({ ...semi, payrollPeriodId: first.id }, tx);
    await finalizePayrollPeriod({ ...semi, payrollPeriodId: first.id, confirmation: 'FINALIZE' }, tx);
    const revised = payload('30000'); revised.monthlySssRemuneration = '32000'; revised.monthlyPagIbigFundSalary = '32000';
    revised.additionalEarnings = [{ id: 'verified-ot', kind: 'OVERTIME', amount: '2000' }];
    await savePayrollStatutoryInput({ ...semi, employeeId: se.id, payrollPeriodId: second.id, payload: revised, evidenceReference: 'Verified synthetic final month remuneration including overtime' }, tx);
    check((await generatePayroll({ ...semi, payrollPeriodId: second.id }, tx)).createdCount === 1, 'second cutoff reconciles an upward revised actual monthly remuneration');
    const reconciled = await tx.payrollEntry.findFirstOrThrow({ where: { payrollPeriodId: second.id } });
    const reconciledSnapshot = (reconciled.calculationSnapshot as Prisma.JsonObject).statutory as Prisma.JsonObject;
    check((reconciledSnapshot.employeeStatutoryDeductions as Prisma.JsonObject).SSS === '850.00' && reconciledSnapshot.birWithholding === '788.70' && reconciled.netAmount.eq('14886.30'), 'second cutoff subtracts actual posted first share, preserving independent BIR calculation');
    const semiAllocations = await tx.payrollContributionAllocation.findMany({ where: { posting: { organizationId: semi.organizationId }, agency: 'SSS' } });
    check(semiAllocations.reduce((sum, item) => sum.add((item.allocation as Prisma.JsonObject).employee as string), new Prisma.Decimal(0)).eq('1600'), 'two SSS employee allocations total the revised monthly liability exactly once');
    evidence.upwardReconciliation = { firstEmployeeSss: '750.00', secondEmployeeSss: '850.00', monthlyEmployeeSss: '1600.00', secondGross: '17000.00', secondBir: '788.70', secondNet: '14886.30' };
    const constraints = await tx.$queryRaw<Array<{ name: string; definition: string }>>`SELECT conname AS name, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='"PayrollContributionAllocation"'::regclass ORDER BY conname`;
    const indexes = await tx.$queryRaw<Array<{ indexname: string; indexdef: string }>>`SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='PayrollContributionAllocation' ORDER BY indexname`;
    check(indexes.some(item => item.indexdef.includes('UNIQUE') && item.indexdef.includes('"monthId", agency, slot')), 'database has unique month/agency/cutoff protection');
    check(constraints.some(item => item.definition.includes('FOREIGN KEY ("monthId", frequency)')), 'database enforces month frequency through composite foreign key');
    await tx.$executeRawUnsafe('SAVEPOINT phase3_frequency_probe');
    let frequencyRejected = false;
    try {
      const allocation = semiAllocations[0];
      await tx.payrollContributionAllocation.create({ data: { monthId: allocation.monthId, postingId: allocation.postingId, frequency: 'MONTHLY', agency: 'PHASE3_PROBE', slot: 'MONTH', allocation: {}, monthlyLiability: {} } });
    } catch (error) { frequencyRejected = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003'; }
    await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT phase3_frequency_probe'); await tx.$executeRawUnsafe('RELEASE SAVEPOINT phase3_frequency_probe');
    check(frequencyRejected, 'database actually rejects a monthly allocation against a semi-monthly guard');
    await tx.$executeRawUnsafe('SAVEPOINT phase3_tenant_probe');
    let tenantRejected = false;
    try { await tx.payrollStatutoryInput.create({ data: { organizationId: semi.organizationId, employeeId: re.id, payrollPeriodId: second.id, payload: {}, evidenceReference: 'fixture', reviewedById: semi.actorUserId } }); }
    catch (error) { tenantRejected = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003'; }
    await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT phase3_tenant_probe'); await tx.$executeRawUnsafe('RELEASE SAVEPOINT phase3_tenant_probe');
    check(tenantRejected, 'database actually rejects cross-tenant statutory input ownership');
    evidence.databaseProtections = { constraints, indexes };
    const migrations = await tx.$queryRaw<Array<{ migration_name: string; checksum: string }>>`SELECT migration_name,checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`;
    evidence.recoveryMigrations = migrations;
    evidence.localMigrations = fs.readdirSync('prisma/migrations', { withFileTypes: true }).filter(item => item.isDirectory()).map(item => item.name);
    throw rollback;
  }, { timeout: 180_000 }); } catch (error) { if (error !== rollback) throw error; }
  return { passed: true, assertions, ...evidence };
}
