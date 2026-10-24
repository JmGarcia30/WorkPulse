'use server';

import { revalidatePath } from 'next/cache';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { canManageLeaveBalances, canReviewLeaveRequests } from '@/lib/permissions/rbac';
import { cancelApprovedLeave, grantCycleEntitlements, retryLeaveAttendanceSync, reviewLeaveRequest } from './service';
import { configureSagaLeavePolicy } from './saga-policy';
import { prisma } from '@/lib/db/prisma';
import { EmploymentStatus, LeaveCountingMode, Prisma } from '@prisma/client';
import { z } from 'zod';
import { LeaveError, normalizeLeaveCode } from './domain';
import { leaveTypeConfigurationSchema, leaveCycleConfigurationSchema, leaveDefaultEntitlementSchema } from './configuration';
import { isSagaLeaveOrganization } from './organization-policy';

const fail = (error: unknown) => ({ error: error instanceof LeaveError ? error.message : error instanceof z.ZodError ? error.issues[0]?.message ?? 'Invalid leave configuration.' : error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002' ? 'This leave code or entitlement already exists.' : 'The leave operation could not be completed.' });

export async function configureSagaLeavePolicyAction(year: number, confirmed: boolean) {
  const user = await requireBackOfficeContext();
  if (!canManageLeaveBalances(user) || !confirmed) return { error: 'Unauthorized or unconfirmed.' };
  try { const configured = await configureSagaLeavePolicy({ organizationId: user.organizationId, actorUserId: user.userId, year }); revalidatePath('/dashboard/leave'); revalidatePath('/dashboard/leave/settings'); return { success: true as const, configured }; } catch (error) { return fail(error); }
}

export async function createLeaveTypeAction(input: { code: string; name: string; description?: string; isPaid: boolean; countingMode: LeaveCountingMode; balanceTracked: boolean; defaultGrantUnits?: number | null; policyReference: string; requiredEmploymentStatus?: EmploymentStatus | null; minimumServiceMonths?: number | null; maximumRequestUnits?: number | null; allowsRetrospectiveFiling?: boolean; requiresEligibilityVerification?: boolean }) {
  const user = await requireBackOfficeContext();
  if (!canManageLeaveBalances(user)) return { error: 'Unauthorized.' };
  try {
    const parsed = leaveTypeConfigurationSchema.parse(input);
    const type = await prisma.leaveType.create({ data: { ...parsed, organizationId: user.organizationId, code: normalizeLeaveCode(parsed.code), description: parsed.description || null, defaultGrantUnits: parsed.defaultGrantUnits == null ? null : new Prisma.Decimal(parsed.defaultGrantUnits), requestCategoryOptions: [], attestationRules: [], documentRules: [] } });
    revalidatePath('/dashboard/leave'); revalidatePath('/dashboard/leave/settings'); return { success: true as const, id: type.id };
  } catch (error) { return fail(error); }
}

export async function createLeaveCycleAction(input: { leaveTypeId: string; code: string; name: string; startDate: string; endDate: string }) {
  const user = await requireBackOfficeContext(); if (!canManageLeaveBalances(user)) return { error: 'Unauthorized.' };
  try { const parsed = leaveCycleConfigurationSchema.parse(input); const type = await prisma.leaveType.findFirst({ where: { id: parsed.leaveTypeId, organizationId: user.organizationId } }); if (!type) throw new LeaveError('NOT_FOUND', 'Leave type not found.'); await prisma.leaveCycle.create({ data: { organizationId: user.organizationId, leaveTypeId: type.id, code: normalizeLeaveCode(parsed.code), name: parsed.name, startDate: new Date(`${parsed.startDate}T00:00:00Z`), endDate: new Date(`${parsed.endDate}T00:00:00Z`) } }); revalidatePath('/dashboard/leave'); revalidatePath('/dashboard/leave/settings'); return { success: true as const }; } catch (error) { return fail(error); }
}

export async function updateLeaveDefaultEntitlementAction(input: { leaveTypeId: string; defaultGrantUnits: number }) {
  const user = await requireBackOfficeContext();
  if (!canManageLeaveBalances(user)) return { error: 'Unauthorized.' };
  try {
    const parsed = leaveDefaultEntitlementSchema.parse(input);
    const type = await prisma.leaveType.findFirst({ where: { id: parsed.leaveTypeId, organizationId: user.organizationId, balanceTracked: true }, include: { organization: { select: { slug: true } } } });
    if (!type) throw new LeaveError('NOT_FOUND', 'Tracked leave type not found.');
    if (isSagaLeaveOrganization(type.organization)) throw new LeaveError('SAGA_POLICY', 'SAGA entitlements are managed through its approved policy preset.');
    await prisma.leaveType.update({ where: { id: type.id, organizationId: user.organizationId }, data: { defaultGrantUnits: new Prisma.Decimal(parsed.defaultGrantUnits) } });
    revalidatePath('/dashboard/leave/settings'); revalidatePath('/dashboard/leave/balances');
    return { success: true as const };
  } catch (error) { return fail(error); }
}

export async function deactivateLeaveTypeAction(leaveTypeId: string, confirmed: boolean) {
  const user = await requireBackOfficeContext(); if (!canManageLeaveBalances(user) || !confirmed) return { error: 'Unauthorized or unconfirmed.' };
  try { await prisma.leaveType.update({ where: { id: leaveTypeId, organizationId: user.organizationId }, data: { isActive: false } }); revalidatePath('/dashboard/leave'); revalidatePath('/dashboard/leave/settings'); return { success: true as const }; } catch (error) { return fail(error); }
}

export async function activateLeaveTypeAction(leaveTypeId: string, confirmed: boolean) {
  const user = await requireBackOfficeContext(); if (!canManageLeaveBalances(user) || !confirmed) return { error: 'Unauthorized or unconfirmed.' };
  try { await prisma.leaveType.update({ where: { id: leaveTypeId, organizationId: user.organizationId }, data: { isActive: true } }); revalidatePath('/dashboard/leave'); revalidatePath('/dashboard/leave/settings'); return { success: true as const }; } catch (error) { return fail(error); }
}

export async function grantCycleEntitlementsAction(input: { leaveTypeId: string; leaveCycleId: string; employeeIds: string[]; reason: string; confirmed: boolean; eligibilityConfirmed?: boolean }) {
  const user = await requireBackOfficeContext();
  if (!canManageLeaveBalances(user) || !input.confirmed) return { error: 'Unauthorized or unconfirmed.' };
  try { const outcomes = await grantCycleEntitlements({ ...input, organizationId: user.organizationId, actorUserId: user.userId }); revalidatePath('/dashboard/leave'); revalidatePath('/dashboard/leave/balances'); return { success: true as const, outcomes }; } catch (error) { return fail(error); }
}

export async function reviewLeaveRequestAction(input: { requestId: string; decision: 'APPROVE' | 'REJECT'; remarks: string; eligibilityChecks?: Record<string, boolean> }) {
  const user = await requireBackOfficeContext();
  if (!canReviewLeaveRequests(user)) return { error: 'Unauthorized.' };
  try { const result = await reviewLeaveRequest({ ...input, organizationId: user.organizationId, actorUserId: user.userId }); revalidatePath('/dashboard/leave'); revalidatePath(`/dashboard/leave/requests/${input.requestId}`); revalidatePath('/employee/leave'); return { success: true as const, ...result }; } catch (error) { return fail(error); }
}

export async function cancelApprovedLeaveAction(requestId: string, reason: string, confirmed: boolean) {
  const user = await requireBackOfficeContext();
  if (!canReviewLeaveRequests(user) || !confirmed) return { error: 'Unauthorized or unconfirmed.' };
  try { await cancelApprovedLeave({ organizationId: user.organizationId, actorUserId: user.userId, requestId, reason }); revalidatePath('/dashboard/leave'); return { success: true as const }; } catch (error) { return fail(error); }
}

export async function retryLeaveAttendanceSyncAction(requestId: string) {
  const user = await requireBackOfficeContext();
  if (!canReviewLeaveRequests(user)) return { error: 'Unauthorized.' };
  try { await retryLeaveAttendanceSync({ organizationId: user.organizationId, actorUserId: user.userId, requestId }); revalidatePath('/dashboard/leave'); return { success: true as const }; } catch (error) { return fail(error); }
}
