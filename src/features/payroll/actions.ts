'use server';

import { revalidatePath } from 'next/cache';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { canManagePayroll } from '@/lib/permissions/rbac';
import { PayrollError } from './domain';
import { createEmployeeCompensation, createPayrollPeriod } from './service';

export type PayrollActionState = { error?: string; success?: string };
const failure = (error: unknown): PayrollActionState => ({ error: error instanceof PayrollError ? error.message : 'The payroll setup could not be saved.' });

export async function createCompensationAction(_state: PayrollActionState, formData: FormData): Promise<PayrollActionState> {
  const user = await requireBackOfficeContext();
  if (!canManagePayroll(user)) return { error: 'Unauthorized to manage payroll.' };
  try {
    await createEmployeeCompensation({ organizationId: user.organizationId, actorUserId: user.userId, employeeId: String(formData.get('employeeId') ?? ''), compensationType: String(formData.get('compensationType') ?? ''), baseRate: String(formData.get('baseRate') ?? ''), payFrequency: String(formData.get('payFrequency') ?? ''), currency: String(formData.get('currency') ?? ''), effectiveFrom: String(formData.get('effectiveFrom') ?? '') });
    revalidatePath('/dashboard/payroll');
    return { success: 'Compensation record created.' };
  } catch (error) { return failure(error); }
}

export async function createPayrollPeriodAction(_state: PayrollActionState, formData: FormData): Promise<PayrollActionState> {
  const user = await requireBackOfficeContext();
  if (!canManagePayroll(user)) return { error: 'Unauthorized to manage payroll.' };
  try {
    await createPayrollPeriod({ organizationId: user.organizationId, actorUserId: user.userId, name: String(formData.get('name') ?? ''), periodStart: String(formData.get('periodStart') ?? ''), periodEnd: String(formData.get('periodEnd') ?? ''), payDate: String(formData.get('payDate') ?? '') });
    revalidatePath('/dashboard/payroll');
    return { success: 'Payroll period created.' };
  } catch (error) { return failure(error); }
}
