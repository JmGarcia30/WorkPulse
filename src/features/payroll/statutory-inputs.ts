import { Prisma, Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { PayrollError, parsePayrollDate } from './domain';
import { lockPayrollEmployee, lockPayrollPeriod, payrollTransaction, type PayrollDb } from './transactions';

const amount = z.string().regex(/^\d+(\.\d{1,2})?$/).refine(value => new Prisma.Decimal(value).lte('9999999999.99'));
const reference = z.string().trim().min(1);
const coverage = z.discriminatedUnion('status', [
  z.object({ status: z.literal('MANDATORY') }).strict(),
  z.object({ status: z.literal('EXEMPT'), legalBasis: reference, evidenceReference: reference, reviewedBy: reference }).strict(),
]);
const deductionTreatment = z.enum(['SALARY_REDUCTION', 'NET_DEDUCTION']);
export const statutoryInputSchema = z.object({
  arrangement: z.literal('PRIVATE_EMPLOYEE_SINGLE_EMPLOYER_FULL_MONTH'),
  earningsComplete: z.literal(true),
  // Explicitly reviewed monthly remuneration/fund-salary mapping; never copied from BIR taxable pay.
  monthlySssRemuneration: amount,
  monthlyPhilHealthBasic: amount,
  monthlyPagIbigFundSalary: amount,
  agencyBasisReference: reference,
  contributionHistory: z.literal('NO_UNTRACKED_CONTRIBUTIONS_FOR_MONTH'),
  coverage: z.object({ SSS: coverage, PHILHEALTH: coverage, PAGIBIG: coverage }).strict(),
  profile: z.object({
    residency: z.literal('RESIDENT_CITIZEN_OR_RESIDENT_ALIEN'),
    employment: z.literal('PRIVATE_RANK_AND_FILE_SINGLE_EMPLOYER'), minimumWageStatus: z.literal('NOT_MWE'),
    previousEmployerInTaxYear: z.literal(false), cumulativeMethodAlreadyRequired: z.literal(false),
    annualizationRequired: z.literal(false), finalPayment: z.literal(false),
  }).strict(),
  additionalEarnings: z.array(z.object({
    id: reference,
    kind: z.enum(['FIXED_ALLOWANCE', 'OVERTIME', 'COMMISSION', 'THIRTEENTH_MONTH', 'QUALIFYING_OTHER_BENEFIT', 'RICE_SUBSIDY', 'CLOTHING_ALLOWANCE', 'LAUNDRY_ALLOWANCE']),
    amount, qualificationReference: reference.optional(),
  }).strict()),
  companyDeductionTreatment: z.object({ late: deductionTreatment, absence: deductionTreatment, undertime: deductionTreatment }).strict(),
  unionDues: z.object({ amount, reference }).strict(),
  otherNetDeductions: z.array(z.object({ id: reference, amount, reference }).strict()),
}).strict();
export type StatutoryPayrollInput = z.infer<typeof statutoryInputSchema>;
export const openingSchema = z.object({
  riceExemptUsedThisMonth: amount, laundryExemptUsedThisMonth: amount,
  clothingExemptUsedThisYear: amount, otherBenefitsGrossPaidYtd: amount,
  taxableCompensationYtd: amount, withholdingTaxYtd: amount,
}).strict();

export function parseStatutoryInput(value: unknown): StatutoryPayrollInput {
  const parsed = statutoryInputSchema.safeParse(value);
  if (!parsed.success) throw new PayrollError('SETUP_REQUIRED', `Resolve statutory earnings, bases, coverage and tax profile: ${parsed.error.issues.map(issue => issue.path.join('.')).join(', ')}.`);
  return parsed.data;
}

async function requireReviewer(db: Prisma.TransactionClient, organizationId: string, actorUserId: string, employeeId: string) {
  const actor = await db.user.findFirst({ where: { id: actorUserId, organizationId, role: { in: [Role.HR_ADMIN, Role.ORGANIZATION_ADMIN] } } });
  if (!actor) throw new PayrollError('FORBIDDEN', 'Unauthorized to verify payroll inputs.');
  if (!await db.employee.findFirst({ where: { id: employeeId, organizationId } })) throw new PayrollError('NOT_FOUND', 'Employee unavailable in this organization.');
}

/** Backend-only reviewed setup; records become immutable as soon as payroll uses them. */
export async function savePayrollStatutoryInput(input: { organizationId: string; actorUserId: string; employeeId: string; payrollPeriodId: string; evidenceReference: string; payload: unknown }, db: PayrollDb = prisma) {
  const payload = parseStatutoryInput(input.payload);
  if (!input.evidenceReference?.trim()) throw new PayrollError('SETUP_REQUIRED', 'Reviewed evidence is required.');
  return payrollTransaction(db, async tx => {
    await requireReviewer(tx, input.organizationId, input.actorUserId, input.employeeId);
    await lockPayrollPeriod(tx, input.organizationId, input.payrollPeriodId);
    await lockPayrollEmployee(tx, input.organizationId, input.employeeId);
    const period = await tx.payrollPeriod.findFirst({ where: { id: input.payrollPeriodId, organizationId: input.organizationId } });
    if (!period) throw new PayrollError('NOT_FOUND', 'Payroll period unavailable.');
    if (period.status === 'FINALIZED' || await tx.payrollEntry.count({ where: { organizationId: input.organizationId, employeeId: input.employeeId, payrollPeriodId: period.id } })) throw new PayrollError('IMMUTABLE', 'Used payroll inputs cannot be replaced; explicit adjustment handling is required.');
    const data = { payload: payload as Prisma.InputJsonObject, evidenceReference: input.evidenceReference, reviewedById: input.actorUserId };
    return tx.payrollStatutoryInput.upsert({ where: { organizationId_employeeId_payrollPeriodId: { organizationId: input.organizationId, employeeId: input.employeeId, payrollPeriodId: period.id } }, create: { organizationId: input.organizationId, employeeId: input.employeeId, payrollPeriodId: period.id, ...data }, update: data });
  });
}

export async function savePayrollTaxOpening(input: { organizationId: string; actorUserId: string; employeeId: string; openingPayDate: string; evidenceReference: string; balances: unknown }, db: PayrollDb = prisma) {
  const parsed = openingSchema.safeParse(input.balances);
  if (!parsed.success || !input.evidenceReference?.trim()) throw new PayrollError('SETUP_REQUIRED', 'Complete verified opening tax and benefit balances, including explicit zeros, are required.');
  const openingPayDate = parsePayrollDate(input.openingPayDate, 'Opening pay date'), taxYear = input.openingPayDate.slice(0, 4);
  return payrollTransaction(db, async tx => {
    await requireReviewer(tx, input.organizationId, input.actorUserId, input.employeeId);
    await lockPayrollEmployee(tx, input.organizationId, input.employeeId);
    if (await tx.payrollStatutoryPosting.count({ where: { organizationId: input.organizationId, employeeId: input.employeeId, taxYear } })) throw new PayrollError('IMMUTABLE', 'Tax opening has already been used.');
    const data = { openingPayDate, balances: parsed.data, evidenceReference: input.evidenceReference, reviewedById: input.actorUserId };
    return tx.payrollTaxOpening.upsert({ where: { organizationId_employeeId_taxYear: { organizationId: input.organizationId, employeeId: input.employeeId, taxYear } }, create: { organizationId: input.organizationId, employeeId: input.employeeId, taxYear, ...data }, update: data });
  });
}
