'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/auth/session';
import {
  canManageEmployees,
  canManageEmploymentLifecycle,
} from '@/lib/permissions/rbac';
import {
  convertApplicationToEmployee,
  EmployeeConversionError,
} from './conversion';
import { parseInstitutionalDate } from './domain';
import {
  doNotRenewEmployee,
  EmploymentLifecycleError,
  regularizeEmployee,
  renewTeachingProbation,
} from './lifecycle';

export async function convertApplicationToEmployeeAction(
  applicationId: string,
  input?: { teachingExpectedEndAt?: string }
) {
  const user = await getSession();
  if (!user || !canManageEmployees(user)) {
    return { error: 'Unauthorized to convert candidates to employees.' };
  }

  const rawDate = input?.teachingExpectedEndAt?.trim();
  const teachingExpectedEndAt = rawDate ? new Date(`${rawDate}T00:00:00.000Z`) : null;
  if (rawDate && Number.isNaN(teachingExpectedEndAt?.getTime())) {
    return { error: 'The Teaching probation end date is invalid.' };
  }

  try {
    const result = await convertApplicationToEmployee({
      applicationId,
      organizationId: user.organizationId,
      actorUserId: user.userId,
      teachingExpectedEndAt,
    });

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/employees');
    revalidatePath(`/dashboard/employees/${result.employeeId}`);
    revalidatePath('/dashboard/hiring/pipeline');
    revalidatePath('/dashboard/hiring/applicants');
    revalidatePath(`/dashboard/hiring/applicants/${applicationId}`);
    return { success: true, ...result };
  } catch (error) {
    if (error instanceof EmployeeConversionError) {
      return { error: error.message, code: error.code };
    }
    console.error('Employee conversion failed:', error);
    return { error: 'Employee conversion failed. No changes were committed.' };
  }
}

type LifecycleActionResult =
  | { success: true; employeeId: string; decision: string }
  | { success?: false; error: string; code?: string };

function lifecycleError(error: unknown): LifecycleActionResult {
  if (error instanceof EmploymentLifecycleError) {
    return { error: error.message, code: error.code };
  }
  if (error instanceof Error) {
    return { error: error.message };
  }
  console.error('Employment lifecycle action failed:', error);
  return { error: 'The employment decision failed. No changes were committed.' };
}

function revalidateEmployeeLifecycle(employeeId: string) {
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/employees');
  revalidatePath(`/dashboard/employees/${employeeId}`);
}

export async function regularizeEmployeeAction(
  employeeId: string,
  input: { confirmed: boolean; regularizationEffectiveAt: string; remarks?: string }
): Promise<LifecycleActionResult> {
  const user = await getSession();
  if (!user || !canManageEmploymentLifecycle(user)) {
    return { error: 'Unauthorized to manage employment lifecycle decisions.' };
  }
  try {
    const result = await regularizeEmployee({
      employeeId,
      organizationId: user.organizationId,
      actorUserId: user.userId,
      confirmed: input.confirmed,
      regularizationEffectiveAt: parseInstitutionalDate(
        input.regularizationEffectiveAt,
        'Regularization effective date'
      ),
      remarks: input.remarks,
    });
    revalidateEmployeeLifecycle(employeeId);
    return { success: true, employeeId, decision: result.decision };
  } catch (error) {
    return lifecycleError(error);
  }
}

export async function renewTeachingProbationAction(
  employeeId: string,
  input: {
    confirmed: boolean;
    nextSchoolYearStartDate: string;
    nextSchoolYearEndDate: string;
    remarks?: string;
  }
): Promise<LifecycleActionResult> {
  const user = await getSession();
  if (!user || !canManageEmploymentLifecycle(user)) {
    return { error: 'Unauthorized to manage employment lifecycle decisions.' };
  }
  try {
    const result = await renewTeachingProbation({
      employeeId,
      organizationId: user.organizationId,
      actorUserId: user.userId,
      confirmed: input.confirmed,
      nextSchoolYearStartDate: parseInstitutionalDate(
        input.nextSchoolYearStartDate,
        'Next school-year start date'
      ),
      nextSchoolYearEndDate: parseInstitutionalDate(
        input.nextSchoolYearEndDate,
        'Next school-year end date'
      ),
      remarks: input.remarks,
    });
    revalidateEmployeeLifecycle(employeeId);
    return { success: true, employeeId, decision: result.decision };
  } catch (error) {
    return lifecycleError(error);
  }
}

export async function doNotRenewEmployeeAction(
  employeeId: string,
  input: { confirmed: boolean; nonRenewalEffectiveAt: string; remarks: string }
): Promise<LifecycleActionResult> {
  const user = await getSession();
  if (!user || !canManageEmploymentLifecycle(user)) {
    return { error: 'Unauthorized to manage employment lifecycle decisions.' };
  }
  try {
    const result = await doNotRenewEmployee({
      employeeId,
      organizationId: user.organizationId,
      actorUserId: user.userId,
      confirmed: input.confirmed,
      nonRenewalEffectiveAt: parseInstitutionalDate(
        input.nonRenewalEffectiveAt,
        'Non-renewal effective date'
      ),
      remarks: input.remarks,
    });
    revalidateEmployeeLifecycle(employeeId);
    return { success: true, employeeId, decision: result.decision };
  } catch (error) {
    return lifecycleError(error);
  }
}
