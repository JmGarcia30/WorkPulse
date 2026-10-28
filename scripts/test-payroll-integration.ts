import assert from 'node:assert/strict';
import { Prisma, type PrismaClient } from '@prisma/client';
import { createEmployeeCompensation, createPayrollPeriod, generatePayroll } from '../src/features/payroll/service';
import { savePayrollStatutoryInput, savePayrollTaxOpening, type StatutoryPayrollInput } from '../src/features/payroll/statutory-inputs';
import { assessPayrollPeriod, finalizePayrollPeriod, movePayrollPeriodToReview } from '../src/features/payroll/review';
import { createPayrollPolicy } from '../src/features/payroll/policy';
import { calculateMonthlyCompensationBase } from '../src/features/payroll/domain';

type Db = Prisma.TransactionClient;
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const opening = { riceExemptUsedThisMonth: '0', laundryExemptUsedThisMonth: '0', clothingExemptUsedThisYear: '0', otherBenefitsGrossPaidYtd: '0', taxableCompensationYtd: '0', withholdingTaxYtd: '0' };
const rollback = new Error('PAYROLL_2B_ROLLBACK');
let assertions = 0;
function check(condition: unknown, message: string) { assert(condition, message); assertions++; console.log(`PASS ${assertions}: ${message}`); }
async function rejects(work: () => Promise<unknown>, code: string) { await assert.rejects(work, error => error instanceof Error && 'code' in error && error.code === code); assertions++; }
const marker = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export async function organization(db: Db) {
  const suffix = marker();
  const org = await db.organization.create({ data: { name: `Payroll 2B ${suffix}`, slug: `payroll2b-${suffix}` } });
  const hr = await db.user.create({ data: { organizationId: org.id, name: 'Payroll HR', email: `payroll2b-${suffix}@example.test`, role: 'HR_ADMIN' } });
  return { organizationId: org.id, actorUserId: hr.id };
}
type Scope = Awaited<ReturnType<typeof organization>>;
export async function employee(db: Db, scope: Scope, frequency: 'MONTHLY' | 'SEMI_MONTHLY' = 'MONTHLY', salary = '35000') {
  const suffix = marker();
  const job = await db.job.create({ data: { organizationId: scope.organizationId, title: 'Payroll fixture', slug: `payroll2b-${suffix}`, department: 'Test', employmentType: 'Full-time', location: 'Test', description: 'Test', responsibilities: 'Test', qualifications: 'Test', requirements: 'Test', category: 'NON_TEACHING', status: 'DRAFT' } });
  const applicant = await db.applicant.create({ data: { firstName: 'Payroll', lastName: suffix, email: `payroll2b-employee-${suffix}@example.test`, phone: '0' } });
  const application = await db.application.create({ data: { applicantId: applicant.id, jobId: job.id, status: 'HIRED', coverLetter: 'Payroll 2B fixture' } });
  const person = await db.employee.create({ data: { organizationId: scope.organizationId, applicantId: applicant.id, sourceApplicationId: application.id, employeeNumber: `2B-${suffix}`, firstName: 'Payroll', lastName: suffix, email: applicant.email, phone: '0', createdById: scope.actorUserId } });
  const employment = await db.employmentRecord.create({ data: { employeeId: person.id, jobTitle: 'Test', department: 'Test', employmentCategory: 'NON_TEACHING', employmentType: 'Full-time', hireDate: date('2026-01-01'), startDate: date('2026-01-01'), effectiveFrom: date('2026-01-01'), employmentStatus: 'REGULAR', salary, payFrequency: frequency, createdById: scope.actorUserId } });
  const compensation = await createEmployeeCompensation({ ...scope, employeeId: person.id, compensationType: 'MONTHLY', baseRate: salary, payFrequency: frequency, currency: 'PHP', effectiveFrom: '2026-01-01' }, db);
  return { ...person, compensation, employment };
}
export function payload(salary = '35000'): StatutoryPayrollInput {
  return {
    arrangement: 'PRIVATE_EMPLOYEE_SINGLE_EMPLOYER_FULL_MONTH', earningsComplete: true,
    monthlySssRemuneration: salary, monthlyPhilHealthBasic: salary, monthlyPagIbigFundSalary: salary,
    agencyBasisReference: 'verified-agency-remuneration-mapping', contributionHistory: 'NO_UNTRACKED_CONTRIBUTIONS_FOR_MONTH',
    coverage: { SSS: { status: 'MANDATORY' }, PHILHEALTH: { status: 'MANDATORY' }, PAGIBIG: { status: 'MANDATORY' } },
    profile: { residency: 'RESIDENT_CITIZEN_OR_RESIDENT_ALIEN', employment: 'PRIVATE_RANK_AND_FILE_SINGLE_EMPLOYER', minimumWageStatus: 'NOT_MWE', previousEmployerInTaxYear: false, cumulativeMethodAlreadyRequired: false, annualizationRequired: false, finalPayment: false },
    additionalEarnings: [], companyDeductionTreatment: { late: 'NET_DEDUCTION', absence: 'NET_DEDUCTION', undertime: 'NET_DEDUCTION' }, unionDues: { amount: '0', reference: 'no-union-dues' }, otherNetDeductions: [],
  };
}
export async function period(db: Db, scope: Scope, start = '2026-09-01', end = '2026-09-30', payDate = end) {
  return createPayrollPeriod({ ...scope, name: `2B ${start}`, periodStart: start, periodEnd: end, payDate }, db);
}
export async function setup(db: Db, scope: Scope, person: { id: string }, payrollPeriodId: string, values = payload(), openingPayDate = '2026-09-15', balances = opening) {
  await savePayrollTaxOpening({ ...scope, employeeId: person.id, openingPayDate, evidenceReference: 'verified-complete-tax-ledger', balances }, db);
  await savePayrollStatutoryInput({ ...scope, employeeId: person.id, payrollPeriodId, payload: values, evidenceReference: 'verified-full-month-agency-coverage-and-earnings' }, db);
}
async function finalize(db: Db, scope: Scope, payrollPeriodId: string) {
  await movePayrollPeriodToReview({ ...scope, payrollPeriodId }, db);
  const review = await assessPayrollPeriod(scope.organizationId, payrollPeriodId, db);
  check(review.canFinalize, `integrated period has no review issues: ${review.issues.map(item => item.message).join(' ')}`);
  await finalizePayrollPeriod({ ...scope, payrollPeriodId, confirmation: 'FINALIZE' }, db);
}
const snap = (value: Prisma.JsonValue | null) => value as unknown as { statutory: { employeeStatutoryDeductions: Record<string, string>; birWithholding: string; taxableCompensation: string; employerContributions: Record<string, { counterpart: string; employerOnly: string }>; companyPolicyTotal: string; bir: { nonTaxableBenefits: string }; yearToDateBefore: { taxableCompensation: string } } };

async function rollbackCases(db: Db) {
  const scope = await organization(db), other = await organization(db);
  const a = await employee(db, scope), b = await employee(db, scope), c = await employee(db, other);
  const p = await period(db, scope), q = await period(db, other);
  await setup(db, scope, a, p.id); await setup(db, scope, b, p.id); await setup(db, other, c, q.id);
  const generated = await generatePayroll({ ...scope, payrollPeriodId: p.id }, db);
  check(generated.createdCount === 2 && generated.setupErrors.length === 0, 'monthly generation handles multiple employees');
  const entries = await db.payrollEntry.findMany({ where: { organizationId: scope.organizationId } });
  for (const entry of entries) {
    const s = snap(entry.calculationSnapshot).statutory;
    check(entry.grossAmount.eq('35000') && entry.totalDeductions.eq('4526.30') && entry.netAmount.eq('30473.70'), 'monthly totals include only employee shares plus withholding');
    check(s.employeeStatutoryDeductions.SSS === '1750.00' && s.employeeStatutoryDeductions.PHILHEALTH === '875.00' && s.employeeStatutoryDeductions.PAGIBIG === '200.00', 'each employee statutory share is separate');
    check(s.taxableCompensation === '32175.00' && s.birWithholding === '1701.30', 'mandatory shares excluded before BIR calculation');
    check(s.employerContributions.SSS.counterpart === '3500.00' && s.employerContributions.SSS.employerOnly === '30.00', 'employer SSS/EC retained separately and excluded from net deductions');
  }
  check(await db.payrollEntry.count({ where: { organizationId: other.organizationId } }) === 0, 'generation does not write another organization');
  await rejects(() => generatePayroll({ ...other, payrollPeriodId: p.id }, db), 'NOT_FOUND');
  await rejects(() => savePayrollStatutoryInput({ ...scope, employeeId: c.id, payrollPeriodId: p.id, payload: payload(), evidenceReference: 'test' }, db), 'NOT_FOUND');
  const manager = await db.user.create({ data: { organizationId: scope.organizationId, name: 'Manager', email: `${marker()}@example.test`, role: 'HIRING_MANAGER' } });
  await rejects(() => generatePayroll({ ...scope, actorUserId: manager.id, payrollPeriodId: p.id }, db), 'FORBIDDEN');
  await rejects(() => savePayrollTaxOpening({ ...scope, actorUserId: manager.id, employeeId: a.id, openingPayDate: '2026-09-15', evidenceReference: 'test', balances: opening }, db), 'FORBIDDEN');
  check((await generatePayroll({ ...scope, payrollPeriodId: p.id }, db)).createdCount === 0 && await db.payrollContributionAllocation.count({ where: { posting: { organizationId: scope.organizationId } } }) === 6, 'retry preserves entries and does not duplicate allocations');
  await rejects(() => savePayrollTaxOpening({ ...scope, employeeId: a.id, openingPayDate: '2026-09-01', evidenceReference: 'test', balances: opening }, db), 'IMMUTABLE');
  await rejects(() => savePayrollStatutoryInput({ ...scope, employeeId: a.id, payrollPeriodId: p.id, payload: payload(), evidenceReference: 'test' }, db), 'IMMUTABLE');
  const before = JSON.stringify(entries.map(item => item.calculationSnapshot));
  await finalize(db, scope, p.id);
  await rejects(() => generatePayroll({ ...scope, payrollPeriodId: p.id }, db), 'FINALIZED');
  check(JSON.stringify((await db.payrollEntry.findMany({ where: { organizationId: scope.organizationId } })).map(item => item.calculationSnapshot)) === before, 'finalization and retry preserve calculation snapshots');
  await generatePayroll({ ...other, payrollPeriodId: q.id }, db);
  check(await db.payrollEntry.count({ where: { organizationId: other.organizationId } }) === 1, 'second organization has independent ledgers');

  const semi = await organization(db), s = await employee(db, semi, 'SEMI_MONTHLY');
  const first = await period(db, semi, '2026-09-01', '2026-09-15');
  const second = await period(db, semi, '2026-09-16', '2026-09-30');
  await setup(db, semi, s, first.id);
  await savePayrollStatutoryInput({ ...semi, employeeId: s.id, payrollPeriodId: second.id, payload: payload(), evidenceReference: 'test' }, db);
  check((await generatePayroll({ ...semi, payrollPeriodId: second.id }, db)).setupErrors[0]?.message.includes('first cutoff'), 'second cutoff without first ledger is blocked');
  check((await generatePayroll({ ...semi, payrollPeriodId: first.id }, db)).createdCount === 1, 'first semi-monthly cutoff generates');
  check((await generatePayroll({ ...semi, payrollPeriodId: second.id }, db)).setupErrors.length === 1, 'unfinalized first cutoff blocks second payment');
  await finalize(db, semi, first.id);
  check((await generatePayroll({ ...semi, payrollPeriodId: second.id }, db)).createdCount === 1, 'second cutoff reconciles finalized first allocation');
  const halves = await db.payrollEntry.findMany({ where: { organizationId: semi.organizationId } });
  check(halves.every(entry => entry.totalDeductions.eq('2263.08') && entry.netAmount.eq('15236.92')), 'semi-monthly tax uses its own table and correct period shares');
  const allocations = await db.payrollContributionAllocation.findMany({ where: { posting: { organizationId: semi.organizationId } } });
  for (const [agency, expected] of [['SSS', '1750'], ['PHILHEALTH', '875'], ['PAGIBIG', '200']]) check(allocations.filter(item => item.agency === agency).reduce((sum, item) => sum.add((item.allocation as Prisma.JsonObject).employee as string), new Prisma.Decimal(0)).eq(expected), `${agency} two cutoffs total exactly one monthly employee liability`);
  check(snap(halves.find(entry => entry.payrollPeriodId === second.id)!.calculationSnapshot).statutory.yearToDateBefore.taxableCompensation === '16087.50', 'second payment uses persisted earlier taxable compensation');
  const oddFirst = calculateMonthlyCompensationBase({ baseRate: new Prisma.Decimal('35000.01'), payFrequency: 'SEMI_MONTHLY', periodStart: date('2026-09-01'), periodEnd: date('2026-09-15') });
  const oddSecond = calculateMonthlyCompensationBase({ baseRate: new Prisma.Decimal('35000.01'), payFrequency: 'SEMI_MONTHLY', periodStart: date('2026-09-16'), periodEnd: date('2026-09-30') });
  check(oddFirst.eq('17500') && oddSecond.eq('17500.01'), 'odd basic-salary centavo settles in second cutoff');

  const missing = await organization(db), m = await employee(db, missing), mp = await period(db, missing);
  check((await generatePayroll({ ...missing, payrollPeriodId: mp.id }, db)).setupErrors.length === 1, 'missing reviewed statutory inputs returns SETUP_REQUIRED');
  await savePayrollStatutoryInput({ ...missing, employeeId: m.id, payrollPeriodId: mp.id, payload: payload(), evidenceReference: 'test' }, db);
  check((await generatePayroll({ ...missing, payrollPeriodId: mp.id }, db)).setupErrors[0].message.includes('opening'), 'unknown tax/benefit history never defaults to zero');
  await setup(db, missing, m, mp.id, { ...payload(), monthlyPagIbigFundSalary: '1500.01' });
  check((await generatePayroll({ ...missing, payrollPeriodId: mp.id }, db)).setupErrors[0].message.includes('ROUNDING_UNVERIFIED'), 'unresolved Pag-IBIG fractional-centavo rounding blocks generation');
  check(await db.payrollStatutoryPosting.count({ where: { organizationId: missing.organizationId } }) === 0 && await db.payrollContributionMonth.count({ where: { organizationId: missing.organizationId } }) === 0, 'failed calculation leaves no partial reservations');
  await rejects(() => movePayrollPeriodToReview({ ...missing, payrollPeriodId: mp.id }, db), 'SETUP_REQUIRED');
  await rejects(() => finalizePayrollPeriod({ ...missing, payrollPeriodId: mp.id, confirmation: 'FINALIZE' }, db), 'NOT_IN_REVIEW');
  await rejects(() => savePayrollStatutoryInput({ ...missing, employeeId: m.id, payrollPeriodId: mp.id, payload: { ...payload(), coverage: {} }, evidenceReference: 'test' }, db), 'SETUP_REQUIRED');
  await rejects(() => savePayrollStatutoryInput({ ...missing, employeeId: m.id, payrollPeriodId: mp.id, payload: { ...payload(), profile: { ...payload().profile, minimumWageStatus: 'MWE' } }, evidenceReference: 'test' }, db), 'SETUP_REQUIRED');

  const benefits = await organization(db), be = await employee(db, benefits), bp = await period(db, benefits);
  const benefitInput = payload(); benefitInput.additionalEarnings = [{ id: 'rice', kind: 'RICE_SUBSIDY', amount: '2500', qualificationReference: 'entitled' }, { id: 'bonus', kind: 'THIRTEENTH_MONTH', amount: '1000', qualificationReference: 'entitled' }];
  await setup(db, benefits, be, bp.id, benefitInput, '2026-09-01', { ...opening, otherBenefitsGrossPaidYtd: '90000', taxableCompensationYtd: '100000', withholdingTaxYtd: '5000' });
  await generatePayroll({ ...benefits, payrollPeriodId: bp.id }, db);
  const ben = await db.payrollEntry.findFirstOrThrow({ where: { organizationId: benefits.organizationId } });
  check(snap(ben.calculationSnapshot).statutory.bir.nonTaxableBenefits === '2500' && snap(ben.calculationSnapshot).statutory.birWithholding === '1851.30', 'persisted exhausted annual pool taxes bonus while retaining qualifying de minimis');
  const posting = await db.payrollStatutoryPosting.findUniqueOrThrow({ where: { payrollEntryId: ben.id } });
  check((posting.benefitUsage as Prisma.JsonObject).otherBenefitsGrossPaidYtd === '1000.00', 'benefit usage delta is persisted atomically');
  await db.payrollContributionAllocation.updateMany({ where: { postingId: posting.id, agency: 'SSS' }, data: { monthlyLiability: { corrupted: true } } });
  await movePayrollPeriodToReview({ ...benefits, payrollPeriodId: bp.id }, db);
  await rejects(() => finalizePayrollPeriod({ ...benefits, payrollPeriodId: bp.id, confirmation: 'FINALIZE' }, db), 'SETUP_REQUIRED');

  const policyScope = await organization(db), pe = await employee(db, policyScope), pp = await period(db, policyScope);
  await createPayrollPolicy({ ...policyScope, effectiveFrom: '2026-01-01', dailyPayBasis: 'SCHEDULED_PAYABLE_DAYS', lateDeductionRule: 'PER_MINUTE', lateDeductionParameter: '1', absenceDeductionRule: 'FIXED_PER_ABSENCE', absenceDeductionParameter: '100', undertimeDeductionRule: 'PER_MINUTE', undertimeDeductionParameter: '10', roundingRule: 'STANDARD_2_DECIMAL' }, db);
  await db.dailyAttendanceRecord.createMany({ data: Array.from({ length: 30 }, (_, index) => ({ organizationId: policyScope.organizationId, employeeId: pe.id, employmentRecordId: pe.employment.id, attendanceDate: date(`2026-09-${String(index + 1).padStart(2, '0')}`), timeZoneSnapshot: 'UTC', attendanceStatus: index === 0 ? 'ABSENT' as const : 'PRESENT' as const, disposition: 'NORMAL' as const, lateSeconds: index === 1 ? 600 : 0, undertimeSeconds: index === 1 ? 120 : 0, lastCalculatedAt: new Date() })) });
  const policyInput = payload(); policyInput.monthlySssRemuneration = '34890'; policyInput.companyDeductionTreatment = { late: 'SALARY_REDUCTION', absence: 'SALARY_REDUCTION', undertime: 'NET_DEDUCTION' };
  await setup(db, policyScope, pe, pp.id, policyInput);
  const pg = await generatePayroll({ ...policyScope, payrollPeriodId: pp.id }, db);
  check(pg.createdCount === 1, `attendance policy generation succeeds: ${JSON.stringify(pg.setupErrors)}`);
  const policyEntry = await db.payrollEntry.findFirstOrThrow({ where: { organizationId: policyScope.organizationId } });
  const ps = snap(policyEntry.calculationSnapshot).statutory;
  check(ps.companyPolicyTotal === '130.00' && ps.taxableCompensation === '32065.00' && ps.birWithholding === '1684.80', 'late/absence salary reductions affect BIR once; undertime net deduction does not reduce tax base');
  check(policyEntry.netAmount.eq('30360.20') && ps.employeeStatutoryDeductions.PHILHEALTH === '875.00', 'attendance deductions preserve company net effect and unreduced PhilHealth basic salary');

  const legacy = await organization(db), le = await employee(db, legacy), lp = await period(db, legacy);
  const historical = await db.payrollEntry.create({ data: { organizationId: legacy.organizationId, employeeId: le.id, employeeCompensationId: le.compensation.id, payrollPeriodId: lp.id, baseAmount: '35000', grossAmount: '35000', totalDeductions: '0', netAmount: '35000', calculationSnapshot: { version: 'H6.2.5', historical: 'untouched' }, status: 'FINALIZED' } });
  await db.payrollPeriod.update({ where: { id: lp.id }, data: { status: 'FINALIZED', finalizedAt: new Date(), finalizedById: legacy.actorUserId } });
  await rejects(() => generatePayroll({ ...legacy, payrollPeriodId: lp.id }, db), 'FINALIZED');
  check(assert.deepEqual((await db.payrollEntry.findUniqueOrThrow({ where: { id: historical.id } })).calculationSnapshot, historical.calculationSnapshot) === undefined, 'legacy finalized H6.2.5 snapshot remains byte-equivalent');
  const earlier = await period(db, legacy, '2026-08-01', '2026-08-31', '2026-09-15');
  await setup(db, legacy, le, earlier.id, payload(), '2026-09-01');
  check((await generatePayroll({ ...legacy, payrollPeriodId: earlier.id }, db)).setupErrors[0].message.includes('no statutory/tax ledger'), 'untracked historical payment after opening blocks tax calculation');
  throw rollback;
}

async function cleanup(db: PrismaClient, scope: Scope) {
  const where = { organizationId: scope.organizationId };
  const people = await db.employee.findMany({ where, select: { applicantId: true } });
  await db.$transaction(async tx => {
    await tx.payrollContributionAllocation.deleteMany({ where: { posting: where } });
    await tx.payrollStatutoryPosting.deleteMany({ where });
    await tx.payrollContributionMonth.deleteMany({ where });
    await tx.payrollStatutoryInput.deleteMany({ where }); await tx.payrollTaxOpening.deleteMany({ where });
    await tx.payrollEntry.deleteMany({ where }); await tx.payrollPeriod.deleteMany({ where });
    await tx.employmentRecord.deleteMany({ where: { employee: where } }); await tx.employeeCompensation.deleteMany({ where });
    await tx.employee.deleteMany({ where }); await tx.application.deleteMany({ where: { job: where } });
    await tx.job.deleteMany({ where }); await tx.applicant.deleteMany({ where: { id: { in: people.map(item => item.applicantId) } } });
    await tx.user.deleteMany({ where }); await tx.organization.delete({ where: { id: scope.organizationId } });
  });
}

export async function runPayrollIntegration(db: PrismaClient) {
  assertions = 0;
  try { await db.$transaction(rollbackCases, { timeout: 240_000 }); } catch (error) { if (error !== rollback) throw error; }
  const scope = await db.$transaction(organization);
  try {
    const fixture = await db.$transaction(async tx => {
      const person = await employee(tx, scope), p = await period(tx, scope);
      await setup(tx, scope, person, p.id); return { person, period: p };
    });
    const input = { ...scope, payrollPeriodId: fixture.period.id };
    try { await db.$transaction(async tx => { await generatePayroll(input, tx); throw rollback; }, { timeout: 120_000 }); } catch (error) { if (error !== rollback) throw error; }
    check(await db.payrollEntry.count({ where: { organizationId: scope.organizationId } }) === 0 && await db.payrollStatutoryPosting.count({ where: { organizationId: scope.organizationId } }) === 0, 'transaction failure rolls back entry, tax usage and contribution reservations together');
    const results = await Promise.all([generatePayroll(input, db), generatePayroll(input, db), generatePayroll(input, db)]);
    check(results.reduce((sum, result) => sum + result.createdCount, 0) === 1, 'three concurrent generations create exactly one entry');
    check(await db.payrollStatutoryPosting.count({ where: { organizationId: scope.organizationId } }) === 1 && await db.payrollContributionAllocation.count({ where: { posting: { organizationId: scope.organizationId } } }) === 3, 'concurrent retries create one tax posting and one allocation per agency');
    const allocation = await db.payrollContributionAllocation.findFirstOrThrow({ where: { posting: { organizationId: scope.organizationId } } });
    const { id: _allocationId, ...duplicate } = allocation;
    void _allocationId;
    await rejects(() => db.payrollContributionAllocation.create({ data: { ...duplicate, allocation: duplicate.allocation as Prisma.InputJsonObject, monthlyLiability: duplicate.monthlyLiability as Prisma.InputJsonObject } }), 'P2002');
    await movePayrollPeriodToReview(input, db);
    const races = await Promise.allSettled([generatePayroll(input, db), db.$transaction(async tx => {
      await finalizePayrollPeriod({ ...input, confirmation: 'FINALIZE' }, tx);
      check((await tx.payrollEntry.findFirstOrThrow({ where: { organizationId: scope.organizationId } })).status === 'FINALIZED', 'concurrent finalization atomically finalizes the entry');
      throw rollback;
    }, { timeout: 120_000 })]);
    check(races[0].status === 'fulfilled' && races[1].status === 'rejected' && races[1].reason === rollback, 'finalization serialized against generation and explicitly rolled back for fixture cleanup');
    check((await db.payrollEntry.findFirstOrThrow({ where: { organizationId: scope.organizationId } })).status === 'REVIEW', 'rollback restores review status with the reservation intact');
  } finally { await cleanup(db, scope); }
  console.log(`Payroll integration: ${assertions} assertions passed`);
  return { passed: true, assertions, rollbackFixtures: true, concurrencyFixturesRemoved: true };
}
