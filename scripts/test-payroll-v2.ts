import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Prisma, PrismaClient } from '@prisma/client';
import { organization, employee, period, setup, runPayrollIntegration } from './test-payroll-integration';
import { runPayrollPresentation } from './test-payroll-presentation';
import { runPayrollWorkflow } from './test-payroll-workflow';
import { runPayrollPhase3 } from './test-payroll-phase3';
import { changePayrollEarning, earningsVersion, validateCustomEarning } from '../src/features/payroll/earnings';
import { generatePayroll } from '../src/features/payroll/service';
import { finalizePayrollPeriod, movePayrollPeriodToReview } from '../src/features/payroll/review';
import { getFinalizedPayslipForEmployee } from '../src/features/payroll/payslip';
import { previewPayrollNotifications, notifyPayrollEmployees, listPayrollNotifications } from '../src/features/payroll/notifications';
import { reusablePayrollSetup } from '../src/features/payroll/reuse';
import { savePayrollStatutoryInput } from '../src/features/payroll/statutory-inputs';

const db = new PrismaClient({ log: [] });
const report: { checks: string[]; amounts: unknown[]; regressions: Record<string, unknown> } = { checks: [], amounts: [], regressions: {} };
const check = (value: unknown, label: string) => { assert(value, label); report.checks.push(label); console.log('PASS', label); };
const rejects = async (fn: () => Promise<unknown>, code: string, label: string) => { await assert.rejects(fn, (e: unknown) => e instanceof Error && 'code' in e && e.code === code); check(true, label); };
const rollback = Error('PAYROLL_V2_ROLLBACK');
async function main() {
  const [identity] = await db.$queryRaw<Array<{ branch: string }>>`SELECT current_setting('neon.branch_id',true) AS branch`;
  assert.equal(identity.branch, process.argv.includes('--rehearsal') ? 'br-lingering-dawn-azrdk13o' : 'br-green-king-azcpyvmo');
  await assert.rejects(async () => validateCustomEarning({ id: 'x', kind: 'REIMBURSEMENT', category: 'OTHER', amount: '10', description: 'Travel', supportingReference: 'receipt', qualificationReference: 'unreviewed' }));
  check(true, 'Unsupported reimbursement classification fails closed');
  try { await db.$transaction(async tx => {
    const scope = await organization(tx), other = await organization(tx), person = await employee(tx, scope), p = await period(tx, scope);
    await setup(tx, scope, person, p.id);
    const input = { ...scope, payrollPeriodId: p.id };
    const user = await tx.user.create({ data: { organizationId: scope.organizationId, role: 'EMPLOYEE', name: 'Synthetic ESS', email: `ess-${person.id}@example.test` } });
    await tx.employeeAccount.create({ data: { organizationId: scope.organizationId, employeeId: person.id, userId: user.id, status: 'ACTIVE', activatedAt: new Date(), createdById: scope.actorUserId } });
    const version = async () => earningsVersion((await tx.payrollStatutoryInput.findUniqueOrThrow({ where: { organizationId_employeeId_payrollPeriodId: { organizationId: scope.organizationId, employeeId: person.id, payrollPeriodId: p.id } } })).payload);
    const change = async (operation: 'SAVE' | 'REMOVE' | 'RECALCULATE', earning?: unknown, earningId?: string) => ({ ...input, employeeId: person.id, operation, earning, earningId, expectedVersion: await version(), reason: 'Synthetic approved payroll input change', confirmRecalculation: true, agencyReview: { monthlySssRemuneration: '37800', monthlyPagIbigFundSalary: '37800', agencyBasisReference: 'Reviewed monthly bases including custom earnings' } });
    const bonus = { id: 'bonus-v2', category: 'BONUS', kind: 'TAXABLE_BONUS', amount: '2000', description: 'Approved project bonus', supportingReference: 'BONUS-2026-09-001', qualificationReference: 'Approved taxable bonus review' };
    async function amounts(label: string, expected: { gross: string; deductions: string; net: string; tax: string }) {
      const result = await generatePayroll(input, tx);
      check(result.createdCount === 1, `${label}: generates one entry`);
      const entry = await tx.payrollEntry.findFirstOrThrow({ where: { organizationId: scope.organizationId, payrollPeriodId: p.id } });
      const actual = { gross: entry.grossAmount.toFixed(2), deductions: entry.totalDeductions.toFixed(2), net: entry.netAmount.toFixed(2), tax: (entry.calculationSnapshot as Prisma.JsonObject).statutory && ((entry.calculationSnapshot as Prisma.JsonObject).statutory as Prisma.JsonObject).birWithholding };
      assert.deepEqual(actual, expected);
      check(true, `${label}: manually calculated gross, employee deductions, BIR and net match`);
      report.amounts.push({ label, expected, actual });
      return entry;
    }
    // Independent pencil-and-paper amounts: SSS 1750 + PHIC 875 + HDMF 200 = 2825.
    // BIR regular taxable = 35000 - 2825 = 32175. Annex E regular bracket is 15%.
    // Supplementary pay uses that regular bracket: 1701.30 + supplementary * .15.
    await amounts('Basic monthly', { gross: '35000.00', deductions: '4526.30', net: '30473.70', tax: '1701.30' });
    const stale = await change('SAVE', bonus);
    await changePayrollEarning(stale, tx);
    await rejects(() => changePayrollEarning(stale, tx), 'STALE_INPUT', 'Repeated earning submission is rejected');
    await amounts('Single taxable bonus', { gross: '37000.00', deductions: '4826.30', net: '32173.70', tax: '2001.30' });
    await changePayrollEarning(await change('SAVE', { ...bonus, id: 'allowance-v2', category: 'ALLOWANCE', kind: 'FIXED_ALLOWANCE', amount: '500', description: 'Taxable transport allowance', supportingReference: 'ALLOWANCE-2026-09-001' }), tx);
    await changePayrollEarning(await change('SAVE', { ...bonus, id: 'overtime-v2', category: 'OVERTIME', kind: 'OVERTIME', amount: '300', description: 'Approved overtime payment', supportingReference: 'OT-2026-09-001' }), tx);
    // Regular taxable with allowance = 32675 (still 15%); 2300 supplementary.
    await amounts('Bonus + taxable allowance + overtime', { gross: '37800.00', deductions: '4946.30', net: '32853.70', tax: '2121.30' });
    await rejects(async () => changePayrollEarning(await change('SAVE', { ...bonus, id: 'duplicate' }), tx), 'DUPLICATE_EARNING', 'Same payment reference cannot be submitted under a second earning ID');
    await rejects(async () => changePayrollEarning({ ...await change('SAVE', bonus), actorUserId: user.id }, tx), 'FORBIDDEN', 'Employee cannot change payroll earnings');
    await rejects(async () => changePayrollEarning({ ...await change('SAVE', bonus), ...other }, tx), 'NOT_FOUND', 'HR cannot edit a foreign tenant payroll period');
    await changePayrollEarning(await change('SAVE', { ...bonus, amount: '1000' }), tx);
    await amounts('Regeneration after bonus edit', { gross: '36800.00', deductions: '4796.30', net: '32003.70', tax: '1971.30' });
    await changePayrollEarning(await change('REMOVE', undefined, 'overtime-v2'), tx);
    const final = await amounts('Regeneration after overtime removal', { gross: '36500.00', deductions: '4751.30', net: '31748.70', tax: '1926.30' });
    const original = JSON.stringify(final.calculationSnapshot);
    check((await generatePayroll(input, tx)).createdCount === 0, 'Repeated generation leaves the entry unchanged');
    check(await tx.payrollStatutoryPosting.count({ where: { payrollEntryId: final.id } }) === 1 && await tx.payrollContributionAllocation.count({ where: { posting: { payrollEntryId: final.id } } }) === 3, 'Recalculation keeps one posting and three contribution allocations');
    check(await tx.payrollInputRevision.count({ where: { organizationId: scope.organizationId } }) === 5, 'Every earning change retains an audit revision');
    await rejects(() => previewPayrollNotifications(input, tx), 'NOT_FINALIZED', 'Notification preview is blocked before finalization');
    await movePayrollPeriodToReview(input, tx); await finalizePayrollPeriod({ ...input, confirmation: 'FINALIZE' }, tx);
    const ess = await getFinalizedPayslipForEmployee({ organizationId: scope.organizationId, userId: user.id, entryId: final.id }, tx);
    check(ess.calculation.netPay === '31748.70' && ess.calculation.additionalEarnings?.[0].description === 'Taxable transport allowance', 'ESS amounts and custom descriptions come from the finalized snapshot');
    const preview = await previewPayrollNotifications(input, tx);
    const notification = { ...input, recipientToken: preview.token, confirmation: 'NOTIFY' };
    await rejects(() => notifyPayrollEmployees({ ...notification, confirmation: '' }, tx), 'CONFIRMATION_REQUIRED', 'Notification requires explicit HR confirmation');
    check((await notifyPayrollEmployees(notification, tx)).created === 1 && (await notifyPayrollEmployees(notification, tx)).created === 0, 'Notification creation is idempotent');
    check((await listPayrollNotifications({ organizationId: scope.organizationId, userId: user.id }, tx)).length === 1, 'Employee sees their persistent in-app notification');
    async function databaseRejects(work: () => Promise<unknown>, label: string, expected?: RegExp) {
      await tx.$executeRawUnsafe('SAVEPOINT v2_security_probe');
      let rejected = false;
      try { await work(); } catch (error) { rejected = !expected || expected.test(String(error) + JSON.stringify(error)); }
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT v2_security_probe');
      await tx.$executeRawUnsafe('RELEASE SAVEPOINT v2_security_probe');
      check(rejected, label);
    }
    await databaseRejects(() => tx.payrollNotification.updateMany({ where: { payrollEntryId: final.id }, data: { message: 'tampered' } }), 'Database rejects notification record tampering');
    await databaseRejects(() => tx.payrollInputRevision.updateMany({ where: { organizationId: scope.organizationId }, data: { reason: 'tampered' } }), 'Database rejects revision audit tampering');
    await databaseRejects(() => tx.payrollNotification.create({ data: { organizationId: scope.organizationId, employeeId: person.id, payrollEntryId: final.id, recipientUserId: other.actorUserId, actorUserId: scope.actorUserId, message: 'Forbidden recipient' } }), 'Database rejects a recipient who does not own the finalized payslip', /Notification requires an owned finalized payslip/);
    await rejects(() => listPayrollNotifications({ organizationId: other.organizationId, userId: user.id }, tx), 'FORBIDDEN', 'Foreign tenant cannot retrieve employee notifications');
    await rejects(async () => changePayrollEarning(await change('SAVE', bonus), tx), 'IMMUTABLE', 'Finalized earnings cannot be edited');
    await rejects(() => generatePayroll(input, tx), 'FINALIZED', 'Finalized payroll cannot be regenerated');
    check(JSON.stringify((await tx.payrollEntry.findUniqueOrThrow({ where: { id: final.id } })).calculationSnapshot) === original, 'Finalized snapshot remains unchanged after notifications and rejected edits');
    const next = await period(tx, scope, '2026-10-01', '2026-10-31');
    check(await reusablePayrollSetup(tx, scope.organizationId, person.id, next) === null, 'Setup reuse cannot copy period-specific earnings to the next payroll');
    const saved = await tx.payrollStatutoryInput.findFirstOrThrow({ where: { payrollPeriodId: p.id, employeeId: person.id } });
    await rejects(() => savePayrollStatutoryInput({ ...scope, employeeId: person.id, payrollPeriodId: next.id, payload: saved.payload, evidenceReference: 'Repeated approved payment reference' }, tx), 'DUPLICATE_EARNING', 'Advanced setup also rejects a repeated payment reference in a later period');
    if (process.argv.includes('--rehearsal')) {
      await databaseRejects(() => tx.$executeRawUnsafe('TRUNCATE TABLE "PayrollNotification"'), 'Database rejects notification TRUNCATE', /Payroll audit and notification records are immutable/);
      await databaseRejects(() => tx.$executeRawUnsafe('TRUNCATE TABLE "PayrollInputRevision"'), 'Database rejects revision TRUNCATE', /Payroll audit and notification records are immutable/);
      await databaseRejects(() => tx.$executeRawUnsafe(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM "PayrollNotification") OR EXISTS (SELECT 1 FROM "PayrollInputRevision") THEN RAISE EXCEPTION 'Payroll V2 rollback refused: retain notification and revision history'; END IF; END $$`), 'Pre-use rollback refuses to discard recorded notification or audit history', /rollback refused/);
      const standalone = await tx.user.create({ data: { organizationId: scope.organizationId, role: 'HR_ADMIN', name: 'Standalone synthetic audit actor', email: `actor-${person.id}@example.test` } });
      const audit = { organizationId: scope.organizationId, employeeId: person.id, payrollPeriodId: next.id, actorUserId: standalone.id, reason: 'Audit retention FK fixture', before: {}, after: {} };
      await tx.payrollInputRevision.create({ data: audit });
      await databaseRejects(() => tx.user.delete({ where: { id: standalone.id } }), 'Audit actor cannot be deleted through an orphaning parent mutation', /Foreign key constraint|foreign key constraint/);
      await databaseRejects(() => tx.payrollInputRevision.create({ data: { ...audit, reason: ' ' } }), 'Database rejects a blank audit reason', /check constraint|Check constraint/);
      await databaseRejects(() => tx.payrollInputRevision.create({ data: { ...audit, before: [] } }), 'Database rejects malformed audit JSON', /check constraint|Check constraint/);
      await tx.employee.update({ where: { id: person.id }, data: { employeeStatus: 'INACTIVE' } });
      await databaseRejects(() => tx.payrollNotification.create({ data: { organizationId: scope.organizationId, employeeId: person.id, payrollEntryId: final.id, recipientUserId: user.id, actorUserId: scope.actorUserId, message: 'Inactive employee probe' } }), 'Database rejects notification creation for an inactive employee', /Notification requires an owned finalized payslip/);
    }
    throw rollback;
  }, { timeout: 180_000 }); } catch (error) { if (error !== rollback) throw error; }
  if (process.argv.includes('--focused')) return;
  report.regressions.integration = await runPayrollIntegration(db);
  report.regressions.presentation = await runPayrollPresentation(db);
  report.regressions.workflow = await runPayrollWorkflow(db);
  report.regressions.phase3 = await runPayrollPhase3(db);
}
main().then(() => { fs.mkdirSync('docs/payroll-v2', { recursive: true }); const rehearsal = process.argv.includes('--rehearsal'); fs.writeFileSync(rehearsal ? 'docs/payroll-v2/review/security-tests.json' : `docs/payroll-v2/${process.argv.includes('--focused') ? 'focused' : 'results'}.json`, JSON.stringify({ passed: true, branch: rehearsal ? 'br-lingering-dawn-azrdk13o' : 'br-green-king-azcpyvmo', ...report }, null, 2)); }).catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
