import { z } from 'zod';
import { EmploymentStatus, LeaveCountingMode } from '@prisma/client';

const units = z.number().finite().min(0).max(999999.9999).refine(value => Math.abs(value * 10000 - Math.round(value * 10000)) < 0.00001, 'Use at most four decimal places.');
export const leaveTypeConfigurationSchema = z.object({
  code: z.string().trim().min(1).max(40), name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional(),
  isPaid: z.boolean(), countingMode: z.nativeEnum(LeaveCountingMode), balanceTracked: z.boolean(),
  defaultGrantUnits: units.nullish(), policyReference: z.string().trim().min(1).max(4000),
  requiredEmploymentStatus: z.nativeEnum(EmploymentStatus).nullish(),
  minimumServiceMonths: z.number().int().min(0).max(1200).nullish(),
  maximumRequestUnits: units.refine(value => value > 0).nullish(),
  allowsRetrospectiveFiling: z.boolean().default(false), requiresEligibilityVerification: z.boolean().default(false),
}).superRefine((value, ctx) => {
  if (value.balanceTracked && value.defaultGrantUnits == null) ctx.addIssue({ code: 'custom', path: ['defaultGrantUnits'], message: 'Set a default entitlement for this tracked leave type.' });
  if (!value.balanceTracked && value.defaultGrantUnits != null) ctx.addIssue({ code: 'custom', path: ['defaultGrantUnits'], message: 'Enable balance tracking before setting an entitlement.' });
});
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Enter a valid calendar date.');
export const leaveCycleConfigurationSchema = z.object({
  leaveTypeId: z.string().min(1), code: z.string().trim().min(1).max(40), name: z.string().trim().min(1).max(120),
  startDate: date, endDate: date,
}).refine(value => value.endDate >= value.startDate, 'Cycle end must not precede its start.');
export const leaveDefaultEntitlementSchema = z.object({ leaveTypeId: z.string().min(1), defaultGrantUnits: units });
