import assert from 'node:assert/strict';
import { type PrismaClient } from '@prisma/client';
import { createEmployeeCompensation, createPayrollPeriod, generatePayroll } from '../src/features/payroll/service';
import { savePayrollStatutoryInput, savePayrollTaxOpening } from '../src/features/payroll/statutory-inputs';
import { finalizePayrollPeriod, movePayrollPeriodToReview } from '../src/features/payroll/review';
import { getFinalizedPayslipForAdmin, getFinalizedPayslipForEmployee, listFinalizedPayslipsForEmployee } from '../src/features/payroll/payslip';
import { getPayrollStatutorySetup } from '../src/features/payroll/setup-queries';
import { statutoryPayloadFromForm, openingBalancesFromForm } from '../src/features/payroll/setup-form';
import { payrollSnapshotBreakdown } from '../src/features/payroll/snapshot-breakdown';
import { readOrganizationBranding } from '../src/features/organization-branding/data';

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const opening = { riceExemptUsedThisMonth: '0', laundryExemptUsedThisMonth: '0', clothingExemptUsedThisYear: '0', otherBenefitsGrossPaidYtd: '0', taxableCompensationYtd: '0', withholdingTaxYtd: '0' };
function setupForm() {
  const form = new FormData();
  for (const name of ['profileReviewed', 'historyReviewed', 'earningsReviewed']) form.set(name, 'CONFIRMED');
  for (const key of ['monthlySssRemuneration', 'monthlyPhilHealthBasic', 'monthlyPagIbigFundSalary']) form.set(key, '35000');
  for (const agency of ['SSS', 'PHILHEALTH', 'PAGIBIG']) form.set(`coverage.${agency}`, 'MANDATORY');
  for (const kind of ['late', 'absence', 'undertime']) form.set(`treatment.${kind}`, 'NET_DEDUCTION');
  form.set('agencyBasisReference', 'verified-bases'); form.set('unionDues', '0'); form.set('unionReference', 'none-verified');
  form.set('additionalEarnings', '[]'); form.set('otherNetDeductions', '[]');
  return form;
}

export async function runPayrollPresentation(db: PrismaClient) {
  let assertions = 0;
  const check = (condition: unknown, message: string) => { assert(condition, message); assertions++; console.log(`UI PASS ${assertions}: ${message}`); };
  const rejects = async (work: () => Promise<unknown>, code: string) => { await assert.rejects(work, error => error instanceof Error && 'code' in error && error.code === code); assertions++; };
  for (const field of ['profileReviewed', 'historyReviewed', 'earningsReviewed', 'monthlySssRemuneration', 'coverage.SSS', 'treatment.late', 'additionalEarnings']) {
    const form = setupForm(); form.delete(field);
    assert.throws(() => statutoryPayloadFromForm(form, 'reviewer')); assertions++;
  }
  const malformed = setupForm(); malformed.set('additionalEarnings', '{bad'); assert.throws(() => statutoryPayloadFromForm(malformed, 'reviewer')); assertions++;
  const forged = setupForm(); forged.set('coverage.SSS', 'EXEMPT'); forged.set('legalBasis.SSS', 'reviewed'); forged.set('evidence.SSS', 'evidence'); forged.set('reviewedBy', 'attacker');
  const parsed = statutoryPayloadFromForm(forged, 'authorized-reviewer');
  check(parsed.coverage.SSS.status === 'EXEMPT' && parsed.coverage.SSS.reviewedBy === 'authorized-reviewer', 'exemption reviewer comes from authenticated action context');
  const missingOpening = new FormData(); missingOpening.set('openingReviewed', 'CONFIRMED'); assert.throws(() => openingBalancesFromForm(missingOpening)); assertions++;
  Object.entries(opening).forEach(([key, value]) => missingOpening.set(key, value));
  check(JSON.stringify(openingBalancesFromForm(missingOpening)) === JSON.stringify(opening), 'opening zero balances require explicit values and review confirmation');
  check(payrollSnapshotBreakdown({ version: 'H6.2.5' }).employee.sss === null, 'legacy statutory amounts remain unknown');
  check(payrollSnapshotBreakdown({ version: 'WORKPULSE-PAYROLL-2B-1', statutory: {} }).format === 'UNAVAILABLE', 'incomplete new snapshot is unavailable rather than fabricated');
  const rollback = new Error('PAYROLL_UI_ROLLBACK');
  let fixtures: unknown;
  try {
    await db.$transaction(async tx => {
      const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      async function fixture(suffix: string, frequency: 'MONTHLY' | 'SEMI_MONTHLY') {
        const org = await tx.organization.create({ data: { name: `Payroll UI ${suffix}`, slug: `payroll-ui-${stamp}-${suffix}` } });
        const hr = await tx.user.create({ data: { organizationId: org.id, name: 'UI HR', email: `${stamp}-${suffix}-hr@example.test`, role: 'HR_ADMIN' } });
        const user = await tx.user.create({ data: { organizationId: org.id, name: 'UI Employee', email: `${stamp}-${suffix}-user@example.test`, role: 'EMPLOYEE' } });
        const manager = await tx.user.create({ data: { organizationId: org.id, name: 'UI Manager', email: `${stamp}-${suffix}-manager@example.test`, role: 'HIRING_MANAGER' } });
        const job = await tx.job.create({ data: { organizationId: org.id, title: 'UI Payroll fixture', slug: `ui-job-${stamp}-${suffix}`, department: 'Test', employmentType: 'Full-time', location: 'Test', description: 'Test', responsibilities: 'Test', qualifications: 'Test', requirements: 'Test', category: 'NON_TEACHING', status: 'DRAFT' } });
        const applicant = await tx.applicant.create({ data: { firstName: 'Payroll', lastName: suffix, email: `${stamp}-${suffix}-applicant@example.test`, phone: '0' } });
        const application = await tx.application.create({ data: { jobId: job.id, applicantId: applicant.id, coverLetter: 'UI test', status: 'HIRED' } });
        const person = await tx.employee.create({ data: { organizationId: org.id, applicantId: applicant.id, sourceApplicationId: application.id, employeeNumber: `UI-${suffix}`, firstName: 'Payroll', lastName: suffix, email: applicant.email, phone: '0', createdById: hr.id } });
        await tx.employmentRecord.create({ data: { employeeId: person.id, jobTitle: 'UI Test', department: 'Test', employmentCategory: 'NON_TEACHING', employmentType: 'Full-time', hireDate: date('2026-01-01'), startDate: date('2026-01-01'), effectiveFrom: date('2026-01-01'), employmentStatus: 'REGULAR', salary: '35000', payFrequency: frequency, createdById: hr.id } });
        await tx.employeeAccount.create({ data: { organizationId: org.id, userId: user.id, employeeId: person.id, status: 'ACTIVE', activatedAt: new Date(), createdById: hr.id } });
        const scope = { organizationId: org.id, actorUserId: hr.id };
        const compensation = await createEmployeeCompensation({ ...scope, employeeId: person.id, compensationType: 'MONTHLY', baseRate: '35000', payFrequency: frequency, currency: 'PHP', effectiveFrom: '2026-01-01' }, tx);
        return { org, hr, user, manager, person, scope, compensation };
      }
      const monthly = await fixture('monthly', 'MONTHLY'), semi = await fixture('semi', 'SEMI_MONTHLY'), missing = await fixture('missing', 'MONTHLY');
      async function create(f: typeof monthly, start: string, end: string) {
        return createPayrollPeriod({ ...f.scope, name: `UI ${start}`, periodStart: start, periodEnd: end, payDate: end }, tx);
      }
      async function run(f: typeof monthly, period: Awaited<ReturnType<typeof create>>) {
        const scope = { ...f.scope, payrollPeriodId: period.id };
        await savePayrollStatutoryInput({ ...scope, employeeId: f.person.id, evidenceReference: 'reviewed-ui-fixture', payload: statutoryPayloadFromForm(setupForm(), f.hr.id) }, tx);
        await generatePayroll(scope, tx); await movePayrollPeriodToReview(scope, tx); await finalizePayrollPeriod({ ...scope, confirmation: 'FINALIZE' }, tx);
        return tx.payrollEntry.findFirstOrThrow({ where: { organizationId: f.org.id, payrollPeriodId: period.id } });
      }
      const mp = await create(monthly, '2026-09-01', '2026-09-30'), first = await create(semi, '2026-09-01', '2026-09-15'), second = await create(semi, '2026-09-16', '2026-09-30');
      for (const f of [monthly, semi]) await savePayrollTaxOpening({ ...f.scope, employeeId: f.person.id, openingPayDate: '2026-09-01', evidenceReference: 'verified-history', balances: opening }, tx);
      const me = await run(monthly, mp), fe = await run(semi, first), se = await run(semi, second);
      const original = JSON.stringify(me.calculationSnapshot);
      const admin = await getFinalizedPayslipForAdmin({ ...monthly.scope, entryId: me.id }, tx);
      const ess = await getFinalizedPayslipForEmployee({ organizationId: monthly.org.id, userId: monthly.user.id, entryId: me.id }, tx);
      check(JSON.stringify(admin) === JSON.stringify(ess), 'HR and authorized ESS use the same finalized snapshot projection');
      check(ess.breakdown.employee.sss === '1750.00' && ess.breakdown.employee.philHealth === '875.00' && ess.breakdown.employee.pagIbig === '200.00' && ess.breakdown.employee.bir === '1701.30', 'monthly payslip exposes exact stored employee statutory amounts');
      check(ess.calculation.netPay === '30473.70' && ess.breakdown.employer[0].counterpart === '3500.00' && ess.breakdown.employer[0].employerOnly === '30.00', 'employer counterparts and EC remain separate from employee totals');
      check(!JSON.stringify(ess).includes('reviewedInput') && !JSON.stringify(ess).includes('verified-history'), 'ESS receives no reviewed input payload or historical evidence');
      const semiFirst = await getFinalizedPayslipForAdmin({ ...semi.scope, entryId: fe.id }, tx), semiSecond = await getFinalizedPayslipForAdmin({ ...semi.scope, entryId: se.id }, tx);
      check(semiFirst.breakdown.allocation?.slot === 'FIRST' && semiSecond.breakdown.allocation?.slot === 'SECOND' && semiSecond.breakdown.employee.sss === '875.00', 'semi-monthly payslips show the allocated cutoff rather than the full monthly liability');
      await rejects(() => getFinalizedPayslipForEmployee({ organizationId: monthly.org.id, userId: monthly.user.id, entryId: se.id }, tx), 'NOT_FOUND');
      await rejects(() => getFinalizedPayslipForEmployee({ organizationId: semi.org.id, userId: monthly.user.id, entryId: se.id }, tx), 'FORBIDDEN');
      await rejects(() => getFinalizedPayslipForAdmin({ ...monthly.scope, actorUserId: monthly.manager.id, entryId: me.id }, tx), 'FORBIDDEN');
      await rejects(() => getPayrollStatutorySetup({ ...monthly.scope, actorUserId: monthly.user.id, payrollPeriodId: mp.id }, tx), 'FORBIDDEN');
      await rejects(() => getPayrollStatutorySetup({ ...monthly.scope, payrollPeriodId: first.id }, tx), 'NOT_FOUND');
      const employeeList = await listFinalizedPayslipsForEmployee({ organizationId: monthly.org.id, userId: monthly.user.id }, tx);
      check(employeeList.length === 1 && employeeList[0].netPay === ess.calculation.netPay, 'ESS list retains the snapshotted totals');
      const locked = await getPayrollStatutorySetup({ ...monthly.scope, payrollPeriodId: mp.id }, tx);
      check(locked[0].inputLocked && locked[0].openingLocked, 'used/finalized setup is read-only');
      const missingPeriod = await create(missing, '2026-09-01', '2026-09-30');
      const setupRows = await getPayrollStatutorySetup({ ...missing.scope, payrollPeriodId: missingPeriod.id }, tx);
      check(setupRows[0].input === null && setupRows[0].opening === null && !setupRows[0].inputLocked, 'missing setup is identified before generation without assumed values');
      const legacyPeriod = await create(monthly, '2026-08-01', '2026-08-31');
      const snapshot = { version: 'H6.2.5', employee: { id: monthly.person.id, name: 'Payroll historical', employeeNumber: 'UI-legacy' }, payrollPeriod: { id: legacyPeriod.id, name: 'Historical August', start: '2026-08-01', end: '2026-08-31', payDate: '2026-08-31' }, compensation: { id: monthly.compensation.id, type: 'MONTHLY', rate: '35000.00', payFrequency: 'MONTHLY', currency: 'PHP' }, policy: { deductionRules: { late: { amount: '10.00' } } }, calculation: { baseAmount: '35000.00', grossAmount: '35000.00', totalDeductions: '10.00', netAmount: '34990.00' } };
      const le = await tx.payrollEntry.create({ data: { organizationId: monthly.org.id, payrollPeriodId: legacyPeriod.id, employeeId: monthly.person.id, employeeCompensationId: monthly.compensation.id, baseAmount: '35000', grossAmount: '35000', totalDeductions: '10', netAmount: '34990', calculationSnapshot: snapshot, status: 'FINALIZED' } });
      await tx.payrollPeriod.update({ where: { id: legacyPeriod.id }, data: { status: 'FINALIZED', finalizedAt: new Date(), finalizedById: monthly.hr.id } });
      const legacy = await getFinalizedPayslipForEmployee({ organizationId: monthly.org.id, userId: monthly.user.id, entryId: le.id }, tx);
      check(legacy.breakdown.format === 'LEGACY' && legacy.breakdown.employee.sss === null && legacy.breakdown.employee.late === '10.00' && legacy.calculation.netPay === '34990.00', 'legacy ESS payslip retains recorded policy deductions and totals without invented statutory zeros');
      check(JSON.stringify((await tx.payrollEntry.findUniqueOrThrow({ where: { id: me.id } })).calculationSnapshot) === original, 'display and setup queries leave finalized snapshots unchanged');
      fixtures = { monthly: admin, first: semiFirst, second: semiSecond, legacy, setupRows, lockedRows: locked, branding: await readOrganizationBranding(tx, { id: monthly.org.id }) };
      throw rollback;
    }, { timeout: 180_000 });
  } catch (error) { if (error !== rollback) throw error; }
  return { assertions, fixtures, passed: true };
}
