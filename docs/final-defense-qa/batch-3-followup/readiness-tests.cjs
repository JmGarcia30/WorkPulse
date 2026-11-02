const assert = require('node:assert/strict');
const { organization, employee, period, setup, payload } = require('../../../scripts/test-payroll-integration.ts');
const { generatePayroll } = require('../../../src/features/payroll/service.ts');
const { getPayrollReadiness } = require('../../../src/features/payroll/readiness.ts');
const { movePayrollPeriodToReview, finalizePayrollPeriod } = require('../../../src/features/payroll/review.ts');
exports.run = async db => {
  let assertions = 0; const checks = [];
  const check = (value, label) => { assert(value, label); assertions++; checks.push(label); };
  const rollback = Error('FOLLOWUP_READINESS_ROLLBACK');
  try { await db.$transaction(async tx => {
    const scope = await organization(tx), person = await employee(tx, scope, 'SEMI_MONTHLY');
    const first = await period(tx, scope, '2026-09-01', '2026-09-15'), second = await period(tx, scope, '2026-09-16', '2026-09-30');
    await setup(tx, scope, person, first.id, payload(), '2026-09-01'); await setup(tx, scope, person, second.id, payload(), '2026-09-01');
    const state = async () => (await getPayrollReadiness({ ...scope, payrollPeriodId: second.id }, tx)).readiness[0];
    check(!(await state()).ready && /first.cutoff.*missing/i.test((await state()).government), 'missing first-cutoff history is not ready and explains the required action');
    check((await generatePayroll({ ...scope, payrollPeriodId: second.id }, tx)).createdCount === 0, 'generation retains the missing-first safeguard');
    check((await getPayrollReadiness({ ...scope, payrollPeriodId: first.id }, tx)).readiness[0].ready, 'a valid first cutoff needs no previous allocation');
    await generatePayroll({ ...scope, payrollPeriodId: first.id }, tx);
    check(!(await state()).ready && /Finalize the first cutoff/.test((await state()).government), 'draft first payroll is not usable');
    await movePayrollPeriodToReview({ ...scope, payrollPeriodId: first.id }, tx);
    check(!(await state()).ready, 'review first payroll is not usable');
    await finalizePayrollPeriod({ ...scope, payrollPeriodId: first.id, confirmation: 'FINALIZE' }, tx);
    check((await state()).ready, 'valid finalized first-cutoff history becomes ready');
    const allocation = await tx.payrollContributionAllocation.findFirstOrThrow({ where: { posting: { organizationId: scope.organizationId }, agency: 'SSS' } });
    const firstEntry = await tx.payrollEntry.findFirstOrThrow({ where: { payrollPeriodId: first.id } });
    const originalSnapshot = JSON.stringify(firstEntry.calculationSnapshot);
    const probes = [
      ['missing agency allocation', () => tx.payrollContributionAllocation.delete({ where: { id: allocation.id } })],
      ['wrong stored slot', () => tx.payrollContributionAllocation.update({ where: { id: allocation.id }, data: { slot: 'SECOND' } })],
      ['malformed JSON', () => tx.payrollContributionAllocation.update({ where: { id: allocation.id }, data: { allocation: { incomplete: true } } })],
      ['inconsistent amount', () => tx.payrollContributionAllocation.update({ where: { id: allocation.id }, data: { allocation: { ...allocation.allocation, employee: '1' } } })],
      ['foreign employee in allocation JSON', () => tx.payrollContributionAllocation.update({ where: { id: allocation.id }, data: { allocation: { ...allocation.allocation, employeeId: 'wrong-employee' } } })],
      ['foreign tenant in allocation JSON', () => tx.payrollContributionAllocation.update({ where: { id: allocation.id }, data: { allocation: { ...allocation.allocation, organizationId: 'wrong-tenant' } } })],
      ['wrong contribution month in JSON', () => tx.payrollContributionAllocation.update({ where: { id: allocation.id }, data: { allocation: { ...allocation.allocation, contributionMonth: '2026-08' } } })],
      ['wrong agency in JSON', () => tx.payrollContributionAllocation.update({ where: { id: allocation.id }, data: { allocation: { ...allocation.allocation, agency: 'PHILHEALTH' } } })],
      ['wrong monthly liability', () => tx.payrollContributionAllocation.update({ where: { id: allocation.id }, data: { monthlyLiability: {} } })],
    ];
    for (const [label, mutate] of probes) {
      await tx.$executeRawUnsafe('SAVEPOINT readiness_bad_history');
      await mutate();
      const before = JSON.stringify(await tx.payrollContributionAllocation.findMany({ where: { postingId: allocation.postingId }, orderBy: { agency: 'asc' } }));
      const row = await state();
      check(!row.ready && /First-cutoff contribution history is invalid/.test(row.government), label + ' blocks readiness');
      check(before === JSON.stringify(await tx.payrollContributionAllocation.findMany({ where: { postingId: allocation.postingId }, orderBy: { agency: 'asc' } })), label + ' preflight is read-only');
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT readiness_bad_history'); await tx.$executeRawUnsafe('RELEASE SAVEPOINT readiness_bad_history');
    }
    // Prove allocation reconciliation still checks an otherwise valid prior ledger.
    await tx.$executeRawUnsafe('SAVEPOINT readiness_lower_liability');
    await tx.payrollStatutoryInput.updateMany({ where: { payrollPeriodId: second.id }, data: { payload: { ...payload(), monthlySssRemuneration: '5000' } } });
    check(!(await state()).ready, 'first allocation exceeding revised liability is not ready');
    await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT readiness_lower_liability'); await tx.$executeRawUnsafe('RELEASE SAVEPOINT readiness_lower_liability');
    const foreign = await organization(tx);
    await assert.rejects(() => getPayrollReadiness({ ...foreign, payrollPeriodId: second.id }, tx), e => e.code === 'NOT_FOUND'); assertions++; checks.push('foreign tenant cannot read second-cutoff readiness');
    check(JSON.stringify((await tx.payrollEntry.findUniqueOrThrow({ where: { id: firstEntry.id } })).calculationSnapshot) === originalSnapshot, 'all readiness probes preserve the finalized first snapshot');
    check((await generatePayroll({ ...scope, payrollPeriodId: second.id }, tx)).createdCount === 1, 'valid historical second-cutoff generation still succeeds');
    check((await state()).ready, 'generated second entry is not misclassified as a duplicate first history');
    check((await generatePayroll({ ...scope, payrollPeriodId: second.id }, tx)).createdCount === 0, 'duplicate second generation stays idempotent');
    await movePayrollPeriodToReview({ ...scope, payrollPeriodId: second.id }, tx); await finalizePayrollPeriod({ ...scope, payrollPeriodId: second.id, confirmation: 'FINALIZE' }, tx);
    check((await state()).ready, 'finalized second entry retains existing readiness behavior');
    const monthScope = await organization(tx), monthly = await employee(tx, monthScope), monthlyPeriod = await period(tx, monthScope);
    await setup(tx, monthScope, monthly, monthlyPeriod.id);
    check((await getPayrollReadiness({ ...monthScope, payrollPeriodId: monthlyPeriod.id }, tx)).readiness[0].ready, 'monthly payroll does not require first-cutoff history');
    const future = await period(tx, monthScope, '2026-11-01', '2026-11-30');
    check(!(await getPayrollReadiness({ ...monthScope, payrollPeriodId: future.id }, tx)).readiness[0].ready, 'November statutory verification restriction remains in force');
    throw rollback;
  }, { timeout: 240000 }); } catch (e) { if (e !== rollback) throw e; }
  return { passed: true, assertions, checks, fixturesRolledBack: true };
};
