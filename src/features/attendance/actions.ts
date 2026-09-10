'use server';

import { AttendanceDirection, AttendanceSource, AttendanceStatus } from '@prisma/client';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import {
  canCorrectAttendance,
  canManageSchedules,
  canRecordAttendance,
  canViewAttendance,
} from '@/lib/permissions/rbac';
import { prisma } from '@/lib/db/prisma';
import { instantForLocalDateTime } from './domain';
import {
  assignSchedule,
  AttendanceError,
  correctAttendance,
  createScheduleVersion,
  materializeAttendancePeriod,
  recordAttendanceEvent,
} from './service';

type ActionResult = { success: true; [key: string]: unknown } | { success?: false; error: string; code?: string };

function failure(error: unknown): ActionResult {
  if (error instanceof AttendanceError) return { error: error.message, code: error.code };
  if (error instanceof Error) return { error: error.message };
  return { error: 'Attendance operation failed. No changes were committed.' };
}

async function organizationTimeZone(organizationId: string): Promise<string> {
  const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { timeZone: true } });
  if (!organization) throw new AttendanceError('NOT_FOUND', 'Organization not found.');
  return organization.timeZone;
}

export async function evaluateAttendancePeriodAction(input: {
  from: string; to: string; employeeId?: string;
}): Promise<never> {
  const user = await getSession();
  if (!user || !canViewAttendance(user)) redirect('/dashboard');
  const query = new URLSearchParams({ from: input.from, to: input.to });
  if (input.employeeId) query.set('employeeId', input.employeeId);
  try {
    await materializeAttendancePeriod({
      organizationId: user.organizationId,
      actorUserId: user.userId,
      employeeIds: input.employeeId ? [input.employeeId] : undefined,
      from: input.from,
      to: input.to,
    });
    revalidatePath('/dashboard/attendance');
  } catch (error) {
    console.error('Attendance period evaluation failed:', error);
    query.set('evaluationError', 'failed');
  }
  redirect(`/dashboard/attendance?${query}`);
}

export async function evaluateAttendanceFormAction(formData: FormData): Promise<never> {
  const from = String(formData.get('from') ?? '');
  const to = String(formData.get('to') ?? '');
  const employeeId = String(formData.get('employeeId') ?? '').trim() || undefined;
  return evaluateAttendancePeriodAction({ from, to, employeeId });
}

export async function createScheduleVersionAction(
  input: Omit<Parameters<typeof createScheduleVersion>[0], 'organizationId' | 'actorUserId'>
): Promise<ActionResult> {
  const user = await getSession();
  if (!user || !canManageSchedules(user)) return { error: 'Unauthorized to manage schedules.' };
  try {
    const result = await createScheduleVersion({ ...input, organizationId: user.organizationId, actorUserId: user.userId });
    revalidatePath('/dashboard/attendance/schedules');
    return { success: true, ...result };
  } catch (error) { return failure(error); }
}

export async function assignScheduleAction(input: {
  employeeId: string; scheduleVersionId: string; effectiveFrom: string; effectiveTo?: string | null;
}): Promise<ActionResult> {
  const user = await getSession();
  if (!user || !canManageSchedules(user)) return { error: 'Unauthorized to manage schedules.' };
  try {
    const result = await assignSchedule({ ...input, organizationId: user.organizationId, actorUserId: user.userId });
    revalidatePath('/dashboard/attendance');
    revalidatePath('/dashboard/attendance/schedules');
    return { success: true, assignmentId: result.id };
  } catch (error) { return failure(error); }
}

export async function recordManualAttendanceEventAction(input: {
  employeeId: string; occurredAtLocal: string; direction: AttendanceDirection; submissionToken: string;
}): Promise<ActionResult> {
  const user = await getSession();
  if (!user || !canRecordAttendance(user)) return { error: 'Unauthorized to record attendance.' };
  if (!/^[0-9a-f-]{36}$/i.test(input.submissionToken)) return { error: 'The attendance form token is invalid.' };
  try {
    const occurredAt = instantForLocalDateTime(input.occurredAtLocal, await organizationTimeZone(user.organizationId));
    const result = await recordAttendanceEvent({
      organizationId: user.organizationId, actorUserId: user.userId,
      employeeId: input.employeeId, occurredAt, direction: input.direction,
      source: AttendanceSource.MANUAL, sourceReference: `manual:${input.submissionToken}`,
    });
    revalidatePath('/dashboard/attendance');
    revalidatePath(`/dashboard/attendance/${input.employeeId}`);
    return { success: true, ...result };
  } catch (error) { return failure(error); }
}

export async function correctAttendanceAction(input: {
  dailyAttendanceRecordId: string; expectedRevision: number;
  correctedTimeInLocal: string | null; correctedTimeOutLocal: string | null;
  correctedStatus: AttendanceStatus; reason: string;
}): Promise<ActionResult> {
  const user = await getSession();
  if (!user || !canCorrectAttendance(user)) return { error: 'Unauthorized to correct attendance.' };
  try {
    const zone = await organizationTimeZone(user.organizationId);
    const result = await correctAttendance({
      organizationId: user.organizationId, actorUserId: user.userId,
      dailyAttendanceRecordId: input.dailyAttendanceRecordId,
      expectedRevision: input.expectedRevision,
      correctedTimeIn: input.correctedTimeInLocal ? instantForLocalDateTime(input.correctedTimeInLocal, zone) : null,
      correctedTimeOut: input.correctedTimeOutLocal ? instantForLocalDateTime(input.correctedTimeOutLocal, zone) : null,
      correctedStatus: input.correctedStatus, reason: input.reason,
    });
    revalidatePath('/dashboard/attendance');
    return { success: true, ...result };
  } catch (error) { return failure(error); }
}
