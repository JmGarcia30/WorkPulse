const assert = require('node:assert/strict');
const { Prisma } = require('@prisma/client');
const { organization, employee, period, setup, payload } = require('../../../scripts/test-payroll-integration.ts');
const { generatePayroll, createEmployeeCompensation, createPayrollPeriod } = require('../../../src/features/payroll/service.ts');
const { getPayrollReadiness } = require('../../../src/features/payroll/readiness.ts');
const { movePayrollPeriodToReview, finalizePayrollPeriod } = require('../../../src/features/payroll/review.ts');
const { getFinalizedPayslipForEmployee, listFinalizedPayslipsForEmployee } = require('../../../src/features/payroll/payslip.ts');
const { calculateSss, calculatePhilHealth, calculatePagIbig } = require('../../../src/features/payroll/statutory/index.ts');
const { assessBirTable } = require('../../../src/features/payroll/bir/index.ts');
const D = n => new Prisma.Decimal(n);
exports.run = async db => {
  let assertions = 0; const cases = [], findings = [];
  function check(value, label) { assert(value, label); assertions++; }
  async function rejects(work, code) { await assert.rejects(work, e => e.code === code); assertions++; }
  const common = { contributionMonth: '2026-09', currency: 'PHP', arrangement: 'PRIVATE_EMPLOYEE_SINGLE_EMPLOYER_FULL_MONTH', coverage: { status: 'MANDATORY' } };
  // Independent selected published SSS rows; no production schedule import.
  for (const [salary, ee, er, ec] of [['5249.99','250','500','10'],['5250','275','550','10'],['14749.99','725','1450','10'],['14750','750','1500','30'],['20250','1025','2050','30'],['34750','1750','3500','30'],['100000','1750','3500','30']]) {
    const r = calculateSss({ ...common, monthlyCompensation: salary });
    check(r.employee.eq(ee) && r.employer.eq(er) && r.employerOnly.eq(ec), 'Independent SSS row ' + salary);
    cases.push({ id: 'SSS-' + salary, expected: { ee, er, ec }, actual: { ee: r.employee.toFixed(2), er: r.employer.toFixed(2), ec: r.employerOnly.toFixed(2) }, status: 'PASS' });
  }
  for (const [salary, ee, er] of [['9000','250','250'],['35000','875','875'],['100000','2500','2500'],['150000','2500','2500'],['10000.20','250','250.01']]) {
    const r = calculatePhilHealth({ ...common, monthlyBasicSalary: salary });
    check(r.employee.eq(ee) && r.employer.eq(er), 'Independent PhilHealth ' + salary);
    cases.push({ id: 'PH-' + salary, expected: { ee, er }, actual: { ee: r.employee.toFixed(2), er: r.employer.toFixed(2) }, status: 'PASS' });
  }
  for (const [salary, ee, er] of [['1500','15','30'],['1550','31','31'],['9999','199.98','199.98'],['10000','200','200'],['35000','200','200']]) {
    const r = calculatePagIbig({ ...common, monthlyFundSalary: salary });
    check(r.employee.eq(ee) && r.employer.eq(er), 'Independent Pag-IBIG ' + salary);
    cases.push({ id: 'PI-' + salary, expected: { ee, er }, actual: { ee: r.employee.toFixed(2), er: r.employer.toFixed(2) }, status: 'PASS' });
  }
  assert.throws(() => calculatePagIbig({ ...common, monthlyFundSalary: '1500.01' }), e => e.code === 'ROUNDING_UNVERIFIED'); assertions++;
  for (const [agency, fn, key] of [['SSS',calculateSss,'monthlyCompensation'],['PH',calculatePhilHealth,'monthlyBasicSalary'],['PI',calculatePagIbig,'monthlyFundSalary']]) {
    assert.throws(() => fn({ ...common, contributionMonth: '2026-11', [key]: '35000' }), e => e.code === 'UNVERIFIED_SCHEDULE'); assertions++;
    cases.push({ id: 'NOV-' + agency, status: 'PASS_SAFETY_GUARD', payrollOutcome: 'BLOCKED', errorCode: 'UNVERIFIED_SCHEDULE' });
  }
  for (const payDate of ['2026-10-23','2026-11-02','2026-11-15','2026-11-30']) {
    assert.throws(() => assessBirTable({ payDate, frequency: 'MONTHLY', taxableCompensation: '32175' }), e => e.code === 'UNVERIFIED_RULES'); assertions++;
    cases.push({ id: 'BIR-' + payDate, status: 'PASS_SAFETY_GUARD', payrollOutcome: 'BLOCKED', errorCode: 'UNVERIFIED_RULES' });
  }
  const rollback = Error('BATCH3_PROBES_ROLLBACK');
  try { await db.$transaction(async tx => {
    const scope = await organization(tx), a = await employee(tx, scope), b = await employee(tx, scope);
    const user = await tx.user.create({ data: { organizationId: scope.organizationId, name: 'Fictional ESS audit', email: 'b3-' + a.id + '@fixture.invalid', role: 'EMPLOYEE' } });
    await tx.employeeAccount.create({ data: { organizationId: scope.organizationId, userId: user.id, employeeId: a.id, status: 'ACTIVE', activatedAt: new Date(), createdById: scope.actorUserId } });
    const p = await period(tx, scope);
    const earnings = payload(); earnings.additionalEarnings = [
      { id: 'allowance', kind: 'FIXED_ALLOWANCE', amount: '1000' },
      { id: 'ot', kind: 'OVERTIME', amount: '2000' },
      { id: 'rice', kind: 'RICE_SUBSIDY', amount: '2500', qualificationReference: 'fictional qualifying rice entitlement' },
      { id: 'laundry', kind: 'LAUNDRY_ALLOWANCE', amount: '400', qualificationReference: 'fictional laundry entitlement' },
      { id: 'clothes', kind: 'CLOTHING_ALLOWANCE', amount: '8000', qualificationReference: 'fictional annual clothing entitlement' },
      { id: '13th', kind: 'THIRTEENTH_MONTH', amount: '1000', qualificationReference: 'fictional partial bonus' },
    ]; earnings.monthlySssRemuneration = '38000'; earnings.monthlyPagIbigFundSalary = '38000';
    const balances = { riceExemptUsedThisMonth: '0', laundryExemptUsedThisMonth: '0', clothingExemptUsedThisYear: '0', otherBenefitsGrossPaidYtd: '89500', taxableCompensationYtd: '200000', withholdingTaxYtd: '10000' };
    await setup(tx, scope, a, p.id, earnings, '2026-09-01', balances); await setup(tx, scope, b, p.id);
    const ready = await getPayrollReadiness({ ...scope, payrollPeriodId: p.id }, tx);
    check(ready.readiness.every(r => r.ready), 'Supported ordinary monthly setup is ready');
    check((await generatePayroll({ ...scope, payrollPeriodId: p.id }, tx)).createdCount === 2, 'Two fictional employees generated');
    const entries = await tx.payrollEntry.findMany({ where: { payrollPeriodId: p.id } }), ae = entries.find(e => e.employeeId === a.id), be = entries.find(e => e.employeeId === b.id);
    const s = ae.calculationSnapshot.statutory;
    const expected = { gross: '49900.00', statutory: '2825.00', taxable: '35675.00', exemptBenefits: '11400.00', bir: '2226.30', net: '44848.70', taxableYtdAfter: '235675.00', taxYtdAfter: '12226.30' };
    const actual = { gross: ae.grossAmount.toFixed(2), statutory: D(s.employeeStatutoryDeductions.SSS).add(s.employeeStatutoryDeductions.PHILHEALTH).add(s.employeeStatutoryDeductions.PAGIBIG).toFixed(2), taxable: s.taxableCompensation, exemptBenefits: D(s.bir.nonTaxableBenefits).toFixed(2), bir: s.birWithholding, net: ae.netAmount.toFixed(2), taxableYtdAfter: s.yearToDateAfter.taxableCompensation, taxYtdAfter: s.yearToDateAfter.withholdingTax };
    check(JSON.stringify(actual) === JSON.stringify(expected), 'Independent mixed earnings and nonzero opening YTD comparison'); cases.push({ id: 'MIXED-EARNINGS-YTD', expected, actual, status: 'PASS' });
    await rejects(() => getFinalizedPayslipForEmployee({ organizationId: scope.organizationId, userId: user.id, entryId: ae.id }, tx), 'NOT_FOUND');
    check((await listFinalizedPayslipsForEmployee({ organizationId: scope.organizationId, userId: user.id }, tx)).length === 0, 'Drafts invisible to ESS');
    await rejects(() => finalizePayrollPeriod({ ...scope, payrollPeriodId: p.id, confirmation: 'FINALIZE' }, tx), 'NOT_IN_REVIEW');
    await movePayrollPeriodToReview({ ...scope, payrollPeriodId: p.id }, tx);
    await rejects(() => getFinalizedPayslipForEmployee({ organizationId: scope.organizationId, userId: user.id, entryId: ae.id }, tx), 'NOT_FOUND');
    await rejects(() => finalizePayrollPeriod({ ...scope, payrollPeriodId: p.id, confirmation: 'YES' }, tx), 'CONFIRMATION_REQUIRED');
    await finalizePayrollPeriod({ ...scope, payrollPeriodId: p.id, confirmation: 'FINALIZE' }, tx);
    check((await getFinalizedPayslipForEmployee({ organizationId: scope.organizationId, userId: user.id, entryId: ae.id }, tx)).calculation.netPay === expected.net, 'Finalized own payslip visible with exact oracle net');
    await rejects(() => getFinalizedPayslipForEmployee({ organizationId: scope.organizationId, userId: user.id, entryId: be.id }, tx), 'NOT_FOUND');
    await tx.employeeAccount.updateMany({ where: { userId: user.id }, data: { status: 'DISABLED', disabledAt: new Date(), disabledReason: 'Fictional audit account disabled' } });
    await rejects(() => listFinalizedPayslipsForEmployee({ organizationId: scope.organizationId, userId: user.id }, tx), 'FORBIDDEN');
    await rejects(() => createEmployeeCompensation({ ...scope, employeeId: a.id, compensationType: 'MONTHLY', payFrequency: 'MONTHLY', currency: 'PHP', baseRate: '-1', effectiveFrom: '2026-01-01' }, tx), 'INVALID_RATE');
    await rejects(() => createEmployeeCompensation({ ...scope, employeeId: a.id, compensationType: 'MONTHLY', payFrequency: 'MONTHLY', currency: 'PHP', baseRate: '35000', effectiveFrom: '2026-01-01' }, tx), 'OVERLAPPING_COMPENSATION');
    await rejects(() => createPayrollPeriod({ ...scope, name: 'Invalid calendar', periodStart: '2026-02-30', periodEnd: '2026-03-31', payDate: '2026-03-31' }, tx), 'INVALID_DATE');
    for (const [start, end, pay] of [['2026-11-01','2026-11-30','2026-11-30'],['2026-11-01','2026-11-15','2026-11-15'],['2026-09-01','2026-09-30','2026-11-02']]) {
      const current = await organization(tx), person = await employee(tx, current, end.endsWith('-15') ? 'SEMI_MONTHLY' : 'MONTHLY'), cp = await period(tx, current, start, end, pay);
      await setup(tx, current, person, cp.id, payload(), '2026-01-01');
      const readiness = await getPayrollReadiness({ ...current, payrollPeriodId: cp.id }, tx), generated = await generatePayroll({ ...current, payrollPeriodId: cp.id }, tx);
      check(!readiness.readiness[0].ready && generated.createdCount === 0 && generated.setupErrors.length === 1, 'Current payment safely blocked ' + pay);
      check(await tx.payrollStatutoryPosting.count({ where: { organizationId: current.organizationId } }) === 0, 'Current blocked payment creates no posting');
      cases.push({ id: 'CURRENT-' + start + '-' + pay, readiness: readiness.readiness[0], generated, status: 'PASS_SAFETY_GUARD', payrollOutcome: 'BLOCKED' });
    }
    const semi = await organization(tx), se = await employee(tx, semi, 'SEMI_MONTHLY'), second = await period(tx, semi, '2026-09-16', '2026-09-30');
    await setup(tx, semi, se, second.id, payload(), '2026-09-01');
    const sr = await getPayrollReadiness({ ...semi, payrollPeriodId: second.id }, tx), sg = await generatePayroll({ ...semi, payrollPeriodId: second.id }, tx);
    check(sg.createdCount === 0 && sg.setupErrors.some(e => /first cutoff/i.test(e.message)), 'Missing first allocation blocks actual generation');
    if (sr.readiness[0].ready) findings.push({ id: 'B3-READINESS', severity: 'P2', readiness: sr.readiness[0], generationErrors: sg.setupErrors, issue: 'Readiness labels second cutoff ready without validating first-cutoff ledger.' });
    cases.push({ id: 'ESS-SECURITY', status: 'PASS', scenarios: ['draft hidden', 'review hidden', 'own finalized visible', 'same-tenant other employee rejected', 'disabled account rejected'] });
    throw rollback;
  }, { timeout: 240000 }); } catch (e) { if (e !== rollback) throw e; }
  return { passed: true, assertions, fixturesRolledBack: true, cases, findings };
};
