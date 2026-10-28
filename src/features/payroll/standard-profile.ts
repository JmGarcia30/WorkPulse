import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { PayrollError } from './domain';
import { savePayrollStatutoryInput } from './statutory-inputs';
import { lockPayrollPeriod, lockPayrollEmployee, payrollTransaction, type PayrollDb } from './transactions';

/** A deliberately narrow shortcut. Every simplifying fact is explicitly attested, never inferred. */
export async function saveStandardPayrollProfile(input: { organizationId: string; actorUserId: string; employeeId: string; payrollPeriodId: string; evidenceReference: string; confirmations: string[]; deductionTreatment: string; compensationId: string; expectedBaseRate: string }, db: PayrollDb = prisma) {
  if (!['basicOnly', 'coverage', 'taxProfile', 'contributionHistory'].every(key => input.confirmations.includes(key))) throw new PayrollError('SETUP_REQUIRED', 'Review every standard-profile statement, or use Advanced Payroll Setup for exceptions.');
  if (!['SALARY_REDUCTION', 'NET_DEDUCTION'].includes(input.deductionTreatment)) throw new PayrollError('SETUP_REQUIRED', 'Review how attendance deductions affect taxable salary.');
  return payrollTransaction(db, async tx => {
    const actor = await tx.user.findFirst({ where: { id: input.actorUserId, organizationId: input.organizationId, role: { in: ['HR_ADMIN', 'ORGANIZATION_ADMIN'] } }, select: { id: true } });
    if (!actor) throw new PayrollError('FORBIDDEN', 'Unauthorized to verify payroll setup.');
    await lockPayrollPeriod(tx, input.organizationId, input.payrollPeriodId);
    await lockPayrollEmployee(tx, input.organizationId, input.employeeId);
    const period = await tx.payrollPeriod.findFirst({ where: { id: input.payrollPeriodId, organizationId: input.organizationId } });
    if (!period) throw new PayrollError('NOT_FOUND', 'Payroll period unavailable.');
    const records = await tx.employeeCompensation.findMany({ where: { organizationId: input.organizationId, employeeId: input.employeeId, status: 'ACTIVE', effectiveFrom: { lte: period.periodStart }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: period.periodEnd } }] } });
    if (records.length !== 1 || records[0].currency !== 'PHP' || records[0].compensationType !== 'MONTHLY' || !['MONTHLY', 'SEMI_MONTHLY'].includes(records[0].payFrequency)) throw new PayrollError('SETUP_REQUIRED', 'Save one applicable fixed monthly PHP salary before reviewing the standard profile.');
    if (records[0].id !== input.compensationId || records[0].baseRate.toFixed(2) !== input.expectedBaseRate) throw new PayrollError('SETUP_REQUIRED', 'Salary changed since this review. Refresh and review the current salary and agency bases.');
    const existing = await tx.payrollStatutoryInput.count({ where: { organizationId: input.organizationId, employeeId: input.employeeId, payrollPeriodId: period.id } });
    if (existing) throw new PayrollError('IMMUTABLE', 'A reviewed profile already exists. Use Advanced Payroll Setup to review changes.');
    const amount = new Prisma.Decimal(records[0].baseRate).toFixed(2);
    return savePayrollStatutoryInput({ ...input, evidenceReference: input.evidenceReference, payload: {
      arrangement: 'PRIVATE_EMPLOYEE_SINGLE_EMPLOYER_FULL_MONTH', earningsComplete: true,
      // Equal bases are valid ONLY after attestation that basic salary is the entire remuneration/Fund Salary.
      monthlySssRemuneration: amount, monthlyPhilHealthBasic: amount, monthlyPagIbigFundSalary: amount,
      agencyBasisReference: 'Verified basic-only monthly remuneration and Fund Salary: ' + input.evidenceReference,
      contributionHistory: 'NO_UNTRACKED_CONTRIBUTIONS_FOR_MONTH',
      coverage: { SSS: { status: 'MANDATORY' }, PHILHEALTH: { status: 'MANDATORY' }, PAGIBIG: { status: 'MANDATORY' } },
      profile: { residency: 'RESIDENT_CITIZEN_OR_RESIDENT_ALIEN', employment: 'PRIVATE_RANK_AND_FILE_SINGLE_EMPLOYER', minimumWageStatus: 'NOT_MWE', previousEmployerInTaxYear: false, cumulativeMethodAlreadyRequired: false, annualizationRequired: false, finalPayment: false },
      additionalEarnings: [], otherNetDeductions: [], unionDues: { amount: '0', reference: 'Explicitly verified no union dues: ' + input.evidenceReference },
      companyDeductionTreatment: { late: input.deductionTreatment, absence: input.deductionTreatment, undertime: input.deductionTreatment },
    } }, tx);
  });
}
