import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';
import { organization, employee, period, setup } from './test-payroll-integration';
import { generatePayroll, deletePayrollPeriod } from '../src/features/payroll/service';
import { movePayrollPeriodToReview, finalizePayrollPeriod } from '../src/features/payroll/review';
import { getPayrollReadiness } from '../src/features/payroll/readiness';
import { reusablePayrollSetup, reusePayrollSetup } from '../src/features/payroll/reuse';
import { saveStandardPayrollProfile } from '../src/features/payroll/standard-profile';

export async function runPayrollWorkflow(db: PrismaClient) {
  let assertions = 0;
  const rollback = Error('WORKFLOW_FIXTURE_ROLLBACK');
  const check = (value: unknown, label: string) => { assert(value, label); assertions++; console.log('WORKFLOW PASS', label); };
  const rejects = async (fn: () => Promise<unknown>) => { await assert.rejects(fn); assertions++; };
  try {
    await db.$transaction(async tx => {
      const scope = await organization(tx), other = await organization(tx);
      const person = await employee(tx, scope);
      const empty = await period(tx, scope, '2026-08-01', '2026-08-31');
      await rejects(() => movePayrollPeriodToReview({ ...scope, payrollPeriodId: empty.id }, tx));
      check((await tx.payrollPeriod.findUniqueOrThrow({ where: { id: empty.id } })).status === 'DRAFT', 'empty payroll stays DRAFT after attempted review');
      await deletePayrollPeriod({ ...scope, payrollPeriodId: empty.id }, tx);
      check(!await tx.payrollPeriod.findUnique({ where: { id: empty.id } }), 'empty draft remains safely deletable');
      const first = await period(tx, scope, '2026-08-01', '2026-08-31');
      const before = await getPayrollReadiness({ ...scope, payrollPeriodId: first.id }, tx);
      check(!before.readiness[0].ready && before.readiness[0].history.includes('do not assume zero'), 'missing statutory setup and opening history are explicit blockers');
      const standard = { ...scope, employeeId: person.id, payrollPeriodId: first.id, evidenceReference: 'Synthetic verified basic-only compensation and coverage', confirmations: ['basicOnly', 'coverage', 'taxProfile', 'contributionHistory'], deductionTreatment: 'NET_DEDUCTION', compensationId: person.compensation.id, expectedBaseRate: '35000.00' };
      await rejects(() => saveStandardPayrollProfile({ ...standard, confirmations: [] }, tx));
      await rejects(() => saveStandardPayrollProfile({ ...standard, expectedBaseRate: '36000.00' }, tx));
      await rejects(() => saveStandardPayrollProfile({ ...standard, organizationId: other.organizationId, actorUserId: other.actorUserId }, tx));
      const standardSaved = await saveStandardPayrollProfile(standard, tx);
      const standardPayload = standardSaved.payload as Record<string, unknown>;
      check(standardPayload.monthlySssRemuneration === '35000.00' && standardPayload.monthlyPagIbigFundSalary === '35000.00', 'standard monthly bases derive from salary only after explicit basic-only and coverage review');
      check(await tx.payrollTaxOpening.count({ where: { employeeId: person.id } }) === 0, 'standard shortcut never invents opening history');
      check((await generatePayroll({ ...scope, payrollPeriodId: first.id }, tx)).setupErrors.some(e => e.message.includes('opening')), 'standard profile still blocks payroll without verified historical balances');
      await setup(tx, scope, person, first.id, undefined, '2026-08-01');
      const generated = await generatePayroll({ ...scope, payrollPeriodId: first.id }, tx);
      check(generated.createdCount === 1, 'verified employee generates statutory payroll');
      await movePayrollPeriodToReview({ ...scope, payrollPeriodId: first.id }, tx);
      await finalizePayrollPeriod({ ...scope, payrollPeriodId: first.id, confirmation: 'FINALIZE' }, tx);
      await rejects(() => deletePayrollPeriod({ ...scope, payrollPeriodId: first.id }, tx));
      const second = await period(tx, scope, '2026-09-01', '2026-09-30');
      const source = await reusablePayrollSetup(tx, scope.organizationId, person.id, second);
      check(source && source.payload.monthlySssRemuneration === '35000', 'finalized verified setup is offered for the same compensation and year');
      const reuse = { ...scope, employeeId: person.id, payrollPeriodId: second.id, sourceId: source!.sourceId, confirmed: true };
      await rejects(() => reusePayrollSetup({ ...reuse, confirmed: false }, tx));
      await rejects(() => reusePayrollSetup({ ...reuse, sourceId: 'forged-source' }, tx));
      await rejects(() => reusePayrollSetup({ ...reuse, organizationId: other.organizationId, actorUserId: other.actorUserId }, tx));
      check(await tx.payrollStatutoryInput.count({ where: { payrollPeriodId: second.id } }) === 0, 'rejected reuse cannot write inputs');
      await reusePayrollSetup(reuse, tx);
      const saved = await tx.payrollStatutoryInput.findFirstOrThrow({ where: { payrollPeriodId: second.id } });
      check(saved.reviewedById === scope.actorUserId && saved.evidenceReference.includes(source!.sourceId), 'reuse preserves source evidence and records the current reviewer');
      await rejects(() => reusePayrollSetup(reuse, tx));
      const ready = await getPayrollReadiness({ ...scope, payrollPeriodId: second.id }, tx);
      check(ready.readiness[0].ready && ready.setup[0].opening?.payDate === '2026-08-01', 'saved setup and verified opening history are reused without entering balances again');
      check((await generatePayroll({ ...scope, payrollPeriodId: second.id }, tx)).createdCount === 1, 'reused configuration passes the actual statutory engine in the next period');
      const future = await period(tx, scope, '2026-11-01', '2026-11-30');
      const blocked = await getPayrollReadiness({ ...scope, payrollPeriodId: future.id }, tx);
      check(!blocked.readiness[0].ready && blocked.readiness[0].government.includes('No verified BIR'), 'unverified pay date displays an explicit blocker');
      const changed = await period(tx, scope, '2026-10-01', '2026-10-15', '2026-10-15');
      await tx.employeeCompensation.update({ where: { id: person.compensation.id }, data: { effectiveFrom: new Date('2026-10-10T00:00:00Z') } });
      const notReady = await getPayrollReadiness({ ...scope, payrollPeriodId: changed.id }, tx);
      check(notReady.readiness[0].salary === 'Salary effective date does not cover this payroll period.', 'effective-date mismatch gives an actionable salary message');
      check(await reusablePayrollSetup(tx, scope.organizationId, person.id, changed) === null, 'salary mismatch prevents reuse');
      throw rollback;
    }, { timeout: 180_000 });
  } catch (error) { if (error !== rollback) throw error; }
  return { passed: true, assertions, fixturesRolledBack: true };
}
