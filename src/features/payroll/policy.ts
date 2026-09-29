import {
  AbsenceDeductionRule,
  DailyPayBasis,
  LateDeductionRule,
  LeavePayrollTreatment,
  PayrollPolicyStatus,
  PayrollRoundingRule,
  Prisma,
  UndertimeDeductionRule,
} from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { PayrollError, parsePayrollDate } from './domain';

type PayrollDb = Prisma.TransactionClient | typeof prisma;

export const DEFAULT_PAYROLL_POLICY = {
  id: 'DEFAULT', version: 0, effectiveFrom: null, effectiveTo: null,
  status: PayrollPolicyStatus.ACTIVE,
  dailyPayBasis: DailyPayBasis.SCHEDULED_PAYABLE_DAYS,
  lateDeductionRule: LateDeductionRule.NONE, lateDeductionParameter: null,
  absenceDeductionRule: AbsenceDeductionRule.NONE, absenceDeductionParameter: null,
  undertimeDeductionRule: UndertimeDeductionRule.NONE, undertimeDeductionParameter: null,
  roundingRule: PayrollRoundingRule.STANDARD_2_DECIMAL,
  leaveTreatments: [],
  isDefault: true,
} as const;

async function requirePolicyAdmin(db: PayrollDb, organizationId: string, actorUserId: string) {
  const actor = await db.user.findFirst({
    where: { id: actorUserId, organizationId, role: { in: ['ORGANIZATION_ADMIN', 'HR_ADMIN'] } }, select: { id: true },
  });
  if (!actor) throw new PayrollError('FORBIDDEN', 'Unauthorized to manage payroll policy.');
}

function parseEnum<T extends string>(value: string, values: readonly T[], label: string): T {
  if (!values.includes(value as T)) throw new PayrollError('INVALID_POLICY', `Unsupported ${label}.`);
  return value as T;
}

function parseParameter(value: string | number | null | undefined, required: boolean, label: string): Prisma.Decimal | null {
  const empty = value === null || value === undefined || String(value).trim() === '';
  if (empty) {
    if (required) throw new PayrollError('INVALID_PARAMETER', `${label} is required for the selected rule.`);
    return null;
  }
  let parameter: Prisma.Decimal;
  try { parameter = new Prisma.Decimal(value as string | number); } catch { throw new PayrollError('INVALID_PARAMETER', `${label} must be a valid number.`); }
  if (!parameter.isFinite() || parameter.lte(0) || parameter.decimalPlaces() > 4) {
    throw new PayrollError('INVALID_PARAMETER', `${label} must be greater than zero with at most four decimal places.`);
  }
  if (!required) throw new PayrollError('INVALID_PARAMETER', `${label} is not allowed for the selected rule.`);
  return parameter;
}

export interface CreatePayrollPolicyInput {
  organizationId: string;
  actorUserId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  dailyPayBasis: string;
  lateDeductionRule: string;
  lateDeductionParameter?: string | number | null;
  absenceDeductionRule: string;
  absenceDeductionParameter?: string | number | null;
  undertimeDeductionRule: string;
  undertimeDeductionParameter?: string | number | null;
  roundingRule: string;
  leaveTreatments?: Array<{ leaveTypeId: string; treatment: string }>;
}

export async function createPayrollPolicy(input: CreatePayrollPolicyInput, db: PayrollDb = prisma) {
  await requirePolicyAdmin(db, input.organizationId, input.actorUserId);
  const effectiveFrom = parsePayrollDate(input.effectiveFrom, 'Effective from');
  const effectiveTo = input.effectiveTo ? parsePayrollDate(input.effectiveTo, 'Effective to') : null;
  if (effectiveTo && effectiveTo < effectiveFrom) throw new PayrollError('INVALID_DATE_RANGE', 'Effective to cannot be before effective from.');
  const dailyPayBasis = parseEnum(input.dailyPayBasis, Object.values(DailyPayBasis), 'daily pay basis');
  const lateDeductionRule = parseEnum(input.lateDeductionRule, Object.values(LateDeductionRule), 'late deduction rule');
  const absenceDeductionRule = parseEnum(input.absenceDeductionRule, Object.values(AbsenceDeductionRule), 'absence deduction rule');
  const undertimeDeductionRule = parseEnum(input.undertimeDeductionRule, Object.values(UndertimeDeductionRule), 'undertime deduction rule');
  const roundingRule = parseEnum(input.roundingRule, Object.values(PayrollRoundingRule), 'rounding rule');
  const lateDeductionParameter = parseParameter(input.lateDeductionParameter, lateDeductionRule !== LateDeductionRule.NONE, 'Late deduction parameter');
  const absenceDeductionParameter = parseParameter(input.absenceDeductionParameter, absenceDeductionRule === AbsenceDeductionRule.FIXED_PER_ABSENCE, 'Absence deduction parameter');
  const undertimeDeductionParameter = parseParameter(input.undertimeDeductionParameter, undertimeDeductionRule !== UndertimeDeductionRule.NONE, 'Undertime deduction parameter');

  const overlap = await db.organizationPayrollPolicy.findFirst({
    where: {
      organizationId: input.organizationId, status: PayrollPolicyStatus.ACTIVE,
      effectiveFrom: { lte: effectiveTo ?? new Date('9999-12-31T00:00:00.000Z') },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
    }, select: { id: true },
  });
  if (overlap) throw new PayrollError('OVERLAPPING_POLICY', 'This policy period overlaps an active payroll policy version.');

  const requestedTreatments = input.leaveTreatments ?? [];
  if (new Set(requestedTreatments.map(item => item.leaveTypeId)).size !== requestedTreatments.length) {
    throw new PayrollError('INVALID_POLICY', 'A leave type can only have one payroll treatment per policy.');
  }
  const leaveTypes = await db.leaveType.findMany({
    where: { organizationId: input.organizationId }, select: { id: true, code: true },
  });
  const leaveTypeById = new Map(leaveTypes.map(item => [item.id, item]));
  const treatments = requestedTreatments.map(item => {
    if (!leaveTypeById.has(item.leaveTypeId)) throw new PayrollError('INVALID_POLICY', 'A leave type is unavailable in this organization.');
    return { leaveTypeId: item.leaveTypeId, treatment: parseEnum(item.treatment, Object.values(LeavePayrollTreatment), 'leave payroll treatment') };
  });
  for (const study of leaveTypes.filter(item => item.code.toUpperCase() === 'STUDY')) {
    const configured = treatments.find(item => item.leaveTypeId === study.id);
    if (configured && configured.treatment !== LeavePayrollTreatment.UNPAID) {
      throw new PayrollError('INVALID_POLICY', 'SAGA Study Leave must be configured as UNPAID.');
    }
    if (!configured) treatments.push({ leaveTypeId: study.id, treatment: LeavePayrollTreatment.UNPAID });
  }
  const latest = await db.organizationPayrollPolicy.findFirst({ where: { organizationId: input.organizationId }, orderBy: { version: 'desc' }, select: { version: true } });
  return db.organizationPayrollPolicy.create({
    data: {
      organizationId: input.organizationId, version: (latest?.version ?? 0) + 1, effectiveFrom, effectiveTo,
      dailyPayBasis, lateDeductionRule, lateDeductionParameter, absenceDeductionRule, absenceDeductionParameter,
      undertimeDeductionRule, undertimeDeductionParameter, roundingRule, createdById: input.actorUserId,
      leaveTreatments: { create: treatments.map(item => ({ organizationId: input.organizationId, ...item })) },
    }, include: { leaveTreatments: { include: { leaveType: true } }, createdBy: { select: { name: true } } },
  });
}

export async function getPayrollPolicyById(organizationId: string, policyId: string, db: PayrollDb = prisma) {
  const policy = await db.organizationPayrollPolicy.findFirst({
    where: { id: policyId, organizationId }, include: { leaveTreatments: { include: { leaveType: true } }, createdBy: { select: { name: true } } },
  });
  if (!policy) throw new PayrollError('NOT_FOUND', 'Payroll policy not found.');
  return policy;
}

export async function resolvePayrollPolicy(organizationId: string, periodStart: Date, periodEnd: Date, db: PayrollDb = prisma) {
  const policies = await db.organizationPayrollPolicy.findMany({
    where: {
      organizationId, status: PayrollPolicyStatus.ACTIVE, effectiveFrom: { lte: periodStart },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodEnd } }],
    }, include: { leaveTreatments: { include: { leaveType: { select: { id: true, code: true, name: true, isPaid: true } } } } },
  });
  if (policies.length > 1) throw new PayrollError('SETUP_REQUIRED', 'Multiple payroll policy versions cover this payroll period.');
  if (policies[0]) return { ...policies[0], isDefault: false as const };
  const partialOrGap = await db.organizationPayrollPolicy.findFirst({
    where: { organizationId, status: PayrollPolicyStatus.ACTIVE, effectiveFrom: { lte: periodEnd } }, select: { id: true },
  });
  if (partialOrGap) throw new PayrollError('SETUP_REQUIRED', 'No single active payroll policy version covers the entire payroll period.');
  return DEFAULT_PAYROLL_POLICY;
}

export function validateResolvedPolicyParameters(policy: {
  lateDeductionRule: LateDeductionRule; lateDeductionParameter: Prisma.Decimal | null;
  absenceDeductionRule: AbsenceDeductionRule; absenceDeductionParameter: Prisma.Decimal | null;
  undertimeDeductionRule: UndertimeDeductionRule; undertimeDeductionParameter: Prisma.Decimal | null;
}) {
  if (policy.lateDeductionRule !== LateDeductionRule.NONE && !policy.lateDeductionParameter) throw new PayrollError('SETUP_REQUIRED', 'The payroll policy is missing its required late deduction parameter.');
  if (policy.absenceDeductionRule === AbsenceDeductionRule.FIXED_PER_ABSENCE && !policy.absenceDeductionParameter) throw new PayrollError('SETUP_REQUIRED', 'The payroll policy is missing its required absence deduction parameter.');
  if (policy.undertimeDeductionRule !== UndertimeDeductionRule.NONE && !policy.undertimeDeductionParameter) throw new PayrollError('SETUP_REQUIRED', 'The payroll policy is missing its required undertime deduction parameter.');
}
