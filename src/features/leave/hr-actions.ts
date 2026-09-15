'use server';

import { revalidatePath } from 'next/cache';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { canManageLeaveBalances, canReviewLeaveRequests } from '@/lib/permissions/rbac';
import { cancelApprovedLeave, grantCycleEntitlements, retryLeaveAttendanceSync, reviewLeaveRequest } from './service';
import { configureSagaLeavePolicy } from './saga-policy';
import { prisma } from '@/lib/db/prisma';
import { LeaveCountingMode, Prisma } from '@prisma/client';
import { LeaveError, normalizeLeaveCode } from './domain';

const fail = (error: unknown) => ({ error: error instanceof LeaveError ? error.message : 'The leave operation could not be completed.' });

export async function configureSagaLeavePolicyAction(year: number, confirmed: boolean) {
  const user = await requireBackOfficeContext();
  if (!canManageLeaveBalances(user) || !confirmed) return { error: 'Unauthorized or unconfirmed.' };
  try { const configured = await configureSagaLeavePolicy({ organizationId: user.organizationId, actorUserId: user.userId, year }); revalidatePath('/dashboard/leave'); revalidatePath('/dashboard/leave/settings'); return { success: true as const, configured }; } catch (error) { return fail(error); }
}

export async function createLeaveTypeAction(input: { code: string; name: string; description?: string; isPaid: boolean; countingMode: LeaveCountingMode; balanceTracked: boolean; defaultGrantUnits?: number | null; policyReference: string }) {
  const user = await requireBackOfficeContext();
  if (!canManageLeaveBalances(user)) return { error: 'Unauthorized.' };
  try {
    const type = await prisma.leaveType.create({ data: { organizationId: user.organizationId, code: normalizeLeaveCode(input.code), name: input.name.trim(), description: input.description?.trim() || null, isPaid: input.isPaid, countingMode: input.countingMode, balanceTracked: input.balanceTracked, defaultGrantUnits: input.defaultGrantUnits == null ? null : new Prisma.Decimal(input.defaultGrantUnits), policyReference: input.policyReference.trim(), requestCategoryOptions: [], attestationRules: [], documentRules: [] } });
    revalidatePath('/dashboard/leave'); revalidatePath('/dashboard/leave/settings'); return { success: true as const, id: type.id };
  } catch (error) { return fail(error); }
}

export async function createLeaveCycleAction(input: { leaveTypeId: string; code: string; name: string; startDate: string; endDate: string }) {
  const user = await requireBackOfficeContext(); if (!canManageLeaveBalances(user)) return { error: 'Unauthorized.' };
  try { const type = await prisma.leaveType.findFirst({ where: { id: input.leaveTypeId, organizationId: user.organizationId } }); if (!type) throw new LeaveError('NOT_FOUND', 'Leave type not found.'); await prisma.leaveCycle.create({ data: { organizationId: user.organizationId, leaveTypeId: type.id, code: normalizeLeaveCode(input.code), name: input.name.trim(), startDate: new Date(`${input.startDate}T00:00:00Z`), endDate: new Date(`${input.endDate}T00:00:00Z`) } }); revalidatePath('/dashboard/leave'); revalidatePath('/dashboard/leave/settings'); return { success: true as const }; } catch (error) { return fail(error); }
}

export async function deactivateLeaveTypeAction(leaveTypeId: string, confirmed: boolean) {
  const user = await requireBackOfficeContext(); if (!canManageLeaveBalances(user) || !confirmed) return { error: 'Unauthorized or unconfirmed.' };
  try { await prisma.leaveType.update({ where: { id: leaveTypeId, organizationId: user.organizationId }, data: { isActive: false } }); revalidatePath('/dashboard/leave'); revalidatePath('/dashboard/leave/settings'); return { success: true as const }; } catch (error) { return fail(error); }
}

export async function grantCycleEntitlementsAction(input: { leaveTypeId: string; leaveCycleId: string; employeeIds: string[]; reason: string; confirmed: boolean; eligibilityConfirmed?: boolean }) {
  const user = await requireBackOfficeContext();
  if (!canManageLeaveBalances(user) || !input.confirmed) return { error: 'Unauthorized or unconfirmed.' };
  try { const outcomes = await grantCycleEntitlements({ organizationId: user.organizationId, actorUserId: user.userId, ...input }); revalidatePath('/dashboard/leave'); revalidatePath('/dashboard/leave/balances'); return { success: true as const, outcomes }; } catch (error) { return fail(error); }
}

export async function reviewLeaveRequestAction(input: { requestId: string; decision: 'APPROVE' | 'REJECT'; remarks: string; eligibilityChecks?: Record<string, boolean> }) {
  const user = await requireBackOfficeContext();
  if (!canReviewLeaveRequests(user)) return { error: 'Unauthorized.' };
  try { const result = await reviewLeaveRequest({ organizationId: user.organizationId, actorUserId: user.userId, ...input }); revalidatePath('/dashboard/leave'); revalidatePath(`/dashboard/leave/requests/${input.requestId}`); revalidatePath('/employee/leave'); return { success: true as const, ...result }; } catch (error) { return fail(error); }
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
