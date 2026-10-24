import { CompensationType, Prisma, type EmployeeCompensation, type PayrollPeriod } from '@prisma/client';
import { isDeepStrictEqual } from 'node:util';
import { PayrollError } from './domain';
import { calculateBirWithholding, BirCalculationError, type BenefitHistory } from './bir';
import { allocateContribution, calculateSss, calculatePhilHealth, calculatePagIbig, StatutoryContributionError, type ContributionAllocation } from './statutory';
import { openingSchema, parseStatutoryInput } from './statutory-inputs';

export const STATUTORY_SNAPSHOT_VERSION = 'WORKPULSE-PAYROLL-2B-1';
export const jsonValue = (value: unknown): Prisma.InputJsonObject => JSON.parse(JSON.stringify(value));
const day = (value: Date) => value.toISOString().slice(0, 10);
const zero = () => new Prisma.Decimal(0);

function reviveAllocation(value: Prisma.JsonValue): ContributionAllocation {
  const saved = value as unknown as ContributionAllocation;
  const amounts = (item: { employee: Prisma.Decimal; employer: Prisma.Decimal; employerOnly: Prisma.Decimal }) => ({ employee: new Prisma.Decimal(item.employee), employer: new Prisma.Decimal(item.employer), employerOnly: new Prisma.Decimal(item.employerOnly) });
  return { ...saved, ...amounts(saved), employerTotal: new Prisma.Decimal(saved.employerTotal), totalRemittance: new Prisma.Decimal(saved.totalRemittance), components: saved.components.map(item => ({ ...item, ...amounts(item) })) };
}

export async function calculateIntegratedPayroll(db: Prisma.TransactionClient, context: {
  organizationId: string; employeeId: string; period: PayrollPeriod;
  compensation: Pick<EmployeeCompensation, 'id' | 'compensationType' | 'payFrequency' | 'baseRate' | 'currency'>;
  baseAmount: Prisma.Decimal;
  companyDeductions: { late: Prisma.Decimal; absence: Prisma.Decimal; undertime: Prisma.Decimal };
}) {
  const { organizationId, employeeId, period, compensation, baseAmount, companyDeductions } = context;
  const fail = (message: string): never => { throw new PayrollError('SETUP_REQUIRED', message); };
  try {
    if (compensation.compensationType !== CompensationType.MONTHLY || !['MONTHLY', 'SEMI_MONTHLY'].includes(compensation.payFrequency)) fail('Statutory integration requires fixed monthly basic salary with monthly or semi-monthly payment; daily/partial/special arrangements require review.');
    if (compensation.currency !== 'PHP') fail('Statutory payroll requires PHP compensation.');
    const frequency = compensation.payFrequency as 'MONTHLY' | 'SEMI_MONTHLY';
    const contributionMonth = day(period.periodStart).slice(0, 7), payDate = day(period.payDate), taxYear = payDate.slice(0, 4);
    const slot = frequency === 'MONTHLY' ? 'MONTH' : period.periodStart.getUTCDate() === 1 ? 'FIRST' : 'SECOND';
    const storedInput = await db.payrollStatutoryInput.findUnique({ where: { organizationId_employeeId_payrollPeriodId: { organizationId, employeeId, payrollPeriodId: period.id } } });
    if (!storedInput) return fail('Verified statutory bases, employee coverage, classified earnings and deduction treatment are required.');
    const input = parseStatutoryInput(storedInput.payload);
    if (!new Prisma.Decimal(input.monthlyPhilHealthBasic).eq(compensation.baseRate)) fail('PhilHealth monthly basic salary must equal the fixed monthly compensation before attendance deductions.');
    const monthStart = new Date(`${contributionMonth}-01T00:00:00.000Z`);
    const monthEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0));
    const employment = await db.employmentRecord.findMany({ where: { employeeId, effectiveFrom: { lte: monthEnd }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: monthStart } }] }, select: { id: true, effectiveFrom: true, effectiveTo: true, startDate: true } });
    const monthCompensation = await db.employeeCompensation.findMany({ where: { organizationId, employeeId, status: 'ACTIVE', effectiveFrom: { lte: monthEnd }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: monthStart } }] }, select: { id: true, effectiveFrom: true, effectiveTo: true } });
    if (employment.length !== 1 || employment[0].startDate > monthStart || employment[0].effectiveFrom > monthStart || (employment[0].effectiveTo && employment[0].effectiveTo < monthEnd)
      || monthCompensation.length !== 1 || monthCompensation[0].id !== compensation.id || monthCompensation[0].effectiveFrom > monthStart || (monthCompensation[0].effectiveTo && monthCompensation[0].effectiveTo < monthEnd)) fail('One employment and unchanged compensation must cover the full contribution month. Partial months or salary changes require review.');

    // Legacy entries cannot establish contribution allocations, even if they have zero deductions.
    const legacyMonth = await db.payrollEntry.count({ where: { organizationId, employeeId, statutoryPosting: null, payrollPeriod: { periodStart: { lte: monthEnd }, periodEnd: { gte: monthStart } } } });
    if (legacyMonth) fail('Existing payroll in this contribution month has no verified allocation ledger; reconcile it explicitly before generation.');
    const opening = await db.payrollTaxOpening.findUnique({ where: { organizationId_employeeId_taxYear: { organizationId, employeeId, taxYear } } });
    if (!opening || day(opening.openingPayDate) > payDate) return fail('Complete persisted opening tax/benefit history is required before this payment date.');
    const balances = openingSchema.safeParse(opening.balances);
    if (!balances.success) return fail('Persisted opening tax/benefit history is incomplete.');
    const untracked = await db.payrollEntry.count({ where: { organizationId, employeeId, statutoryPosting: null, payrollPeriod: { payDate: { gte: opening.openingPayDate, lte: new Date(`${taxYear}-12-31T00:00:00.000Z`) } } } });
    if (untracked) fail('Payroll after the verified opening date has no statutory/tax ledger. Reconcile historical payments before generation.');
    const postings = await db.payrollStatutoryPosting.findMany({ where: { organizationId, employeeId, taxYear }, include: { entry: { include: { payrollPeriod: true } } }, orderBy: [{ payDate: 'asc' }, { id: 'asc' }] });
    if (postings.some(item => day(item.payDate) >= payDate || item.entry.status !== 'FINALIZED' || item.entry.payrollPeriod.status !== 'FINALIZED')) fail('Finalize earlier payments first and generate in strictly increasing payment-date order; off-cycle/same-day payments require review.');
    const history: BenefitHistory = {
      organizationId, employeeId, taxYear, paymentMonth: payDate.slice(0, 7), reference: opening.id, completeBeforeCurrentPayment: true,
      riceExemptUsedThisMonth: opening.openingPayDate.toISOString().slice(0, 7) === payDate.slice(0, 7) ? balances.data.riceExemptUsedThisMonth : '0',
      laundryExemptUsedThisMonth: opening.openingPayDate.toISOString().slice(0, 7) === payDate.slice(0, 7) ? balances.data.laundryExemptUsedThisMonth : '0',
      clothingExemptUsedThisYear: balances.data.clothingExemptUsedThisYear, otherBenefitsGrossPaidYtd: balances.data.otherBenefitsGrossPaidYtd,
    };
    let taxableYtd = new Prisma.Decimal(balances.data.taxableCompensationYtd), taxYtd = new Prisma.Decimal(balances.data.withholdingTaxYtd);
    for (const posting of postings) {
      const usage = openingSchema.safeParse(posting.benefitUsage);
      if (!usage.success) return fail('A previous payment has incomplete persisted tax/benefit usage.');
      for (const key of ['riceExemptUsedThisMonth', 'laundryExemptUsedThisMonth', 'clothingExemptUsedThisYear', 'otherBenefitsGrossPaidYtd'] as const) {
        if ((key === 'riceExemptUsedThisMonth' || key === 'laundryExemptUsedThisMonth') && day(posting.payDate).slice(0, 7) !== payDate.slice(0, 7)) continue;
        history[key] = new Prisma.Decimal(history[key]).add(usage.data[key]).toFixed(2);
      }
      taxableYtd = taxableYtd.add(usage.data.taxableCompensationYtd); taxYtd = taxYtd.add(usage.data.withholdingTaxYtd);
    }
    const guard = await db.payrollContributionMonth.findUnique({ where: { organizationId_employeeId_contributionMonth: { organizationId, employeeId, contributionMonth } }, include: { allocations: { include: { posting: { include: { entry: { include: { payrollPeriod: true } } } } } } } });
    if (guard && guard.frequency !== frequency) fail('Contribution frequency cannot change within a month.');
    if (guard?.allocations.some(item => item.posting.entry.status !== 'FINALIZED' || item.posting.entry.payrollPeriod.status !== 'FINALIZED')) fail('Finalize the first contribution cutoff before generating the second.');
    const contributionContext = { contributionMonth, currency: 'PHP' as const, arrangement: input.arrangement };
    const liabilities = [
      calculateSss({ ...contributionContext, coverage: input.coverage.SSS, monthlyCompensation: input.monthlySssRemuneration }),
      calculatePhilHealth({ ...contributionContext, coverage: input.coverage.PHILHEALTH, monthlyBasicSalary: input.monthlyPhilHealthBasic }),
      calculatePagIbig({ ...contributionContext, coverage: input.coverage.PAGIBIG, monthlyFundSalary: input.monthlyPagIbigFundSalary }),
    ];
    const allocations = liabilities.map(liability => allocateContribution(liability, { organizationId, employeeId, frequency, slot, priorAllocations: (guard?.allocations ?? []).filter(item => item.agency === liability.agency).map(item => reviveAllocation(item.allocation)) }));
    const salaryReduction = Object.entries(companyDeductions).reduce((sum, [key, value]) => input.companyDeductionTreatment[key as keyof typeof companyDeductions] === 'SALARY_REDUCTION' ? sum.add(value) : sum, zero());
    const companyTotal = Object.values(companyDeductions).reduce((sum, value) => sum.add(value), zero());
    if (salaryReduction.gt(baseAmount)) fail('Company salary reductions exceed basic earnings.');
    const earnings = [{ id: 'BASIC_SALARY', kind: 'BASIC_SALARY' as const, amount: baseAmount.sub(salaryReduction).toFixed(2) }, ...input.additionalEarnings];
    const bir = calculateBirWithholding({
      organizationId, employeeId, periodId: period.id, currency: 'PHP', frequency,
      periodStart: day(period.periodStart), periodEnd: day(period.periodEnd), payDate,
      earningsComplete: true, grossCompensation: earnings.reduce((sum, item) => sum.add(item.amount), zero()), earnings, benefitHistory: history,
      profile: input.profile, unionDues: input.unionDues,
      otherNetDeductions: [...input.otherNetDeductions, { id: 'COMPANY_POLICY_NET', amount: companyTotal.sub(salaryReduction).toFixed(2), reference: storedInput.id }],
      statutoryDeductions: allocations.map((allocation, index) => ({
        organizationId, employeeId, periodId: period.id, contributionMonth, agency: allocation.agency,
        employeeShare: allocation.employee, treatment: liabilities[index].status === 'EXEMPT' ? 'REVIEWED_EXEMPT' : 'MANDATORY_EMPLOYEE_SHARE',
        reference: allocation.allocationKey, legalBasis: liabilities[index].exemption?.legalBasis,
      })),
    });
    const grossAmount = bir.grossCompensation.add(salaryReduction);
    const totalDeductions = bir.totalEmployeeDeductions.add(salaryReduction);
    if (grossAmount.gt('9999999999.99') || totalDeductions.gt('9999999999.99')) fail('Payroll amounts exceed supported monetary storage limits.');
    const usage = jsonValue({ ...Object.fromEntries(Object.entries(bir.earnings.closingBalances).map(([key, value]) => [key, value.sub(history[key as keyof typeof bir.earnings.closingBalances]).toFixed(2)])), taxableCompensationYtd: bir.taxableCompensation.toFixed(2), withholdingTaxYtd: bir.withholdingTax.toFixed(2) });
    const snapshot = jsonValue({
      version: STATUTORY_SNAPSHOT_VERSION, reviewedInputId: storedInput.id, reviewedInput: storedInput.payload, inputEvidence: storedInput.evidenceReference, reviewedById: storedInput.reviewedById,
      openingId: opening.id, contributionMonth, frequency, slot, monthlyLiabilities: liabilities, allocations,
      grossCompensation: grossAmount.toFixed(2), taxableCompensation: bir.taxableCompensation.toFixed(2),
      employeeStatutoryDeductions: Object.fromEntries(allocations.map(item => [item.agency, item.employee.toFixed(2)])),
      birWithholding: bir.withholdingTax.toFixed(2), companyPolicyDeductions: jsonValue(companyDeductions), companyPolicyTotal: companyTotal.toFixed(2), salaryReduction: salaryReduction.toFixed(2),
      employerContributions: Object.fromEntries(allocations.map(item => [item.agency, { counterpart: item.employer.toFixed(2), employerOnly: item.employerOnly.toFixed(2), total: item.employerTotal.toFixed(2) }])),
      totalDeductions: totalDeductions.toFixed(2), netPay: bir.netPay.toFixed(2), bir,
      yearToDateBefore: { taxableCompensation: taxableYtd.toFixed(2), withholdingTax: taxYtd.toFixed(2) },
      yearToDateAfter: { taxableCompensation: taxableYtd.add(bir.taxableCompensation).toFixed(2), withholdingTax: taxYtd.add(bir.withholdingTax).toFixed(2) },
    });
    return { snapshot, usage, allocations, liabilities, grossAmount, totalDeductions, netAmount: bir.netPay, contributionMonth, frequency, taxYear };
  } catch (error) {
    if (error instanceof BirCalculationError || error instanceof StatutoryContributionError) throw new PayrollError('SETUP_REQUIRED', `${error.code}: ${error.message}`);
    throw error;
  }
}

export async function persistIntegratedPayroll(db: Prisma.TransactionClient, entry: { id: string; organizationId: string; employeeId: string }, period: PayrollPeriod, result: Awaited<ReturnType<typeof calculateIntegratedPayroll>>) {
  const { organizationId, employeeId } = entry;
  const month = await db.payrollContributionMonth.upsert({ where: { organizationId_employeeId_contributionMonth: { organizationId, employeeId, contributionMonth: result.contributionMonth } }, create: { organizationId, employeeId, contributionMonth: result.contributionMonth, frequency: result.frequency }, update: {} });
  const posting = await db.payrollStatutoryPosting.create({ data: { organizationId, employeeId, payrollEntryId: entry.id, payDate: period.payDate, taxYear: result.taxYear, benefitUsage: result.usage, calculation: result.snapshot } });
  for (const [index, allocation] of result.allocations.entries()) await db.payrollContributionAllocation.create({ data: { monthId: month.id, postingId: posting.id, frequency: result.frequency, agency: allocation.agency, slot: allocation.slot, allocation: jsonValue(allocation), monthlyLiability: jsonValue(result.liabilities[index]) } });
}

/** Finalization verifies the exact reserved calculation, without recalculating historical payroll. */
export async function statutoryEntryIssue(db: Prisma.TransactionClient, entry: { id: string; organizationId: string; employeeId: string; calculationSnapshot: Prisma.JsonValue | null; grossAmount: Prisma.Decimal; totalDeductions: Prisma.Decimal; netAmount: Prisma.Decimal }) {
  const snapshot = entry.calculationSnapshot as Prisma.JsonObject | null;
  if (snapshot?.version !== STATUTORY_SNAPSHOT_VERSION || !snapshot.statutory) return 'SETUP_REQUIRED: This unfinalized entry lacks verified statutory integration; explicit replacement/adjustment is required.';
  const posting = await db.payrollStatutoryPosting.findUnique({ where: { payrollEntryId: entry.id }, include: { allocations: true } });
  if (!posting || posting.organizationId !== entry.organizationId || posting.employeeId !== entry.employeeId || posting.allocations.length !== 3 || !isDeepStrictEqual(posting.calculation, snapshot.statutory)) return 'SETUP_REQUIRED: Statutory/tax reservation ledger does not match this entry.';
  const saved = posting.calculation as Prisma.JsonObject;
  if (saved.grossCompensation !== entry.grossAmount.toFixed(2) || saved.totalDeductions !== entry.totalDeductions.toFixed(2) || saved.netPay !== entry.netAmount.toFixed(2)) return 'SETUP_REQUIRED: Statutory totals do not reconcile to payroll.';
  const allocations = saved.allocations as Prisma.JsonArray, liabilities = saved.monthlyLiabilities as Prisma.JsonArray;
  for (const item of posting.allocations) {
    const index = allocations.findIndex(value => (value as Prisma.JsonObject).agency === item.agency);
    if (index < 0 || !isDeepStrictEqual(allocations[index], item.allocation) || !isDeepStrictEqual(liabilities[index], item.monthlyLiability)) return 'SETUP_REQUIRED: Contribution allocation or schedule differs from the immutable snapshot.';
  }
  return null;
}
