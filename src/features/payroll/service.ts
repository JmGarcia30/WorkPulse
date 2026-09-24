import { CompensationStatus, Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { PayrollError, parseCompensationType, parsePayFrequency, parsePayrollDate, validateCurrency } from './domain';

type PayrollDb = Prisma.TransactionClient | typeof prisma;

async function requirePayrollAdmin(db: PayrollDb, organizationId: string, actorUserId: string) {
  const actor = await db.user.findFirst({
    where: { id: actorUserId, organizationId, role: { in: [Role.ORGANIZATION_ADMIN, Role.HR_ADMIN] } },
    select: { id: true },
  });
  if (!actor) throw new PayrollError('FORBIDDEN', 'Unauthorized to manage payroll.');
}

export interface CreateCompensationInput {
  organizationId: string;
  actorUserId: string;
  employeeId: string;
  compensationType: string;
  baseRate: string | number;
  payFrequency: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export async function createEmployeeCompensation(input: CreateCompensationInput, db: PayrollDb = prisma) {
  await requirePayrollAdmin(db, input.organizationId, input.actorUserId);
  const employee = await db.employee.findFirst({ where: { id: input.employeeId, organizationId: input.organizationId }, select: { id: true } });
  if (!employee) throw new PayrollError('EMPLOYEE_NOT_FOUND', 'Employee is unavailable in this organization.');

  let baseRate: Prisma.Decimal;
  try { baseRate = new Prisma.Decimal(input.baseRate); } catch { throw new PayrollError('INVALID_RATE', 'Base rate must be a valid amount.'); }
  if (!baseRate.isFinite() || baseRate.lte(0) || baseRate.decimalPlaces() > 2) throw new PayrollError('INVALID_RATE', 'Base rate must be greater than zero with at most two decimal places.');

  const effectiveFrom = parsePayrollDate(input.effectiveFrom, 'Effective from');
  const effectiveTo = input.effectiveTo ? parsePayrollDate(input.effectiveTo, 'Effective to') : null;
  if (effectiveTo && effectiveTo < effectiveFrom) throw new PayrollError('INVALID_DATE_RANGE', 'Effective to cannot be before effective from.');

  const overlap = await db.employeeCompensation.findFirst({
    where: {
      organizationId: input.organizationId,
      employeeId: employee.id,
      effectiveFrom: { lte: effectiveTo ?? new Date('9999-12-31T00:00:00.000Z') },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
    },
    select: { id: true },
  });
  if (overlap) throw new PayrollError('OVERLAPPING_COMPENSATION', 'This compensation range overlaps an existing record.');

  return db.employeeCompensation.create({
    data: {
      organizationId: input.organizationId,
      employeeId: employee.id,
      compensationType: parseCompensationType(input.compensationType),
      baseRate,
      payFrequency: parsePayFrequency(input.payFrequency),
      currency: validateCurrency(input.currency),
      effectiveFrom,
      effectiveTo,
      status: CompensationStatus.ACTIVE,
    },
  });
}

export interface CreatePayrollPeriodInput {
  organizationId: string;
  actorUserId: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
}

export async function createPayrollPeriod(input: CreatePayrollPeriodInput, db: PayrollDb = prisma) {
  await requirePayrollAdmin(db, input.organizationId, input.actorUserId);
  const name = input.name.trim();
  if (!name || name.length > 120) throw new PayrollError('INVALID_NAME', 'Period name is required and must be at most 120 characters.');
  const periodStart = parsePayrollDate(input.periodStart, 'Period start');
  const periodEnd = parsePayrollDate(input.periodEnd, 'Period end');
  const payDate = parsePayrollDate(input.payDate, 'Pay date');
  if (periodEnd < periodStart) throw new PayrollError('INVALID_DATE_RANGE', 'Period end cannot be before period start.');
  if (payDate < periodStart) throw new PayrollError('INVALID_PAY_DATE', 'Pay date cannot be before the period starts.');

  const overlap = await db.payrollPeriod.findFirst({
    where: { organizationId: input.organizationId, periodStart: { lte: periodEnd }, periodEnd: { gte: periodStart } },
    select: { id: true },
  });
  if (overlap) throw new PayrollError('OVERLAPPING_PERIOD', 'This payroll period overlaps an existing period.');
  try {
    return await db.payrollPeriod.create({ data: { organizationId: input.organizationId, name, periodStart, periodEnd, payDate } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new PayrollError('DUPLICATE_PERIOD', 'A payroll period with this name already exists.');
    throw error;
  }
}

export async function getCompensationById(organizationId: string, compensationId: string, db: PayrollDb = prisma) {
  const record = await db.employeeCompensation.findFirst({ where: { id: compensationId, organizationId }, include: { employee: true } });
  if (!record) throw new PayrollError('NOT_FOUND', 'Compensation record not found.');
  return record;
}

export async function getPayrollPeriodById(organizationId: string, payrollPeriodId: string, db: PayrollDb = prisma) {
  const period = await db.payrollPeriod.findFirst({ where: { id: payrollPeriodId, organizationId } });
  if (!period) throw new PayrollError('NOT_FOUND', 'Payroll period not found.');
  return period;
}
