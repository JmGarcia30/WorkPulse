'use server';

import { revalidatePath } from 'next/cache';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { canManagePayroll } from '@/lib/permissions/rbac';
import { PayrollError } from './domain';
import { createEmployeeCompensation, createPayrollPeriod, generatePayroll, deletePayrollPeriod } from './service';
import { createPayrollPolicy } from './policy';
import { finalizePayrollPeriod, movePayrollPeriodToReview } from './review';
import { savePayrollStatutoryInput, savePayrollTaxOpening } from './statutory-inputs';
import { statutoryPayloadFromForm, openingBalancesFromForm } from './setup-form';

export type PayrollActionState = { error?: string; success?: string; setupErrors?: Array<{ employeeNumber: string; employeeName: string; message: string }> };
const failure = (error: unknown): PayrollActionState => ({ error: error instanceof PayrollError ? `${error.code === 'SETUP_REQUIRED' ? 'SETUP_REQUIRED: ' : ''}${error.message}` : error instanceof Error ? error.message : 'The payroll action could not be completed.' });

export async function saveStatutorySetupAction(_state: PayrollActionState, form: FormData): Promise<PayrollActionState> {
  const user = await requireBackOfficeContext();
  if (!canManagePayroll(user)) return { error: 'Unauthorized to verify statutory payroll setup.' };
  try {
    await savePayrollStatutoryInput({ organizationId: user.organizationId, actorUserId: user.userId, employeeId: String(form.get('employeeId') ?? ''), payrollPeriodId: String(form.get('payrollPeriodId') ?? ''), evidenceReference: String(form.get('evidenceReference') ?? ''), payload: statutoryPayloadFromForm(form, user.userId) });
    revalidatePath('/dashboard/payroll');
    return { success: 'Reviewed period inputs saved. Generate payroll to run all calculation checks.' };
  } catch (error) { return failure(error); }
}

export async function saveTaxOpeningAction(_state: PayrollActionState, form: FormData): Promise<PayrollActionState> {
  const user = await requireBackOfficeContext();
  if (!canManagePayroll(user)) return { error: 'Unauthorized to verify payroll history.' };
  try {
    await savePayrollTaxOpening({ organizationId: user.organizationId, actorUserId: user.userId, employeeId: String(form.get('employeeId') ?? ''), openingPayDate: String(form.get('openingPayDate') ?? ''), evidenceReference: String(form.get('evidenceReference') ?? ''), balances: openingBalancesFromForm(form) });
    revalidatePath('/dashboard/payroll');
    return { success: 'Verified opening history saved. Later payments will use persisted payroll history.' };
  } catch (error) { return failure(error); }
}

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

export async function generatePayrollAction(_state: PayrollActionState, formData: FormData): Promise<PayrollActionState> {
  const user = await requireBackOfficeContext();
  if (!canManagePayroll(user)) return { error: 'Unauthorized to manage payroll.' };
  try {
    const result = await generatePayroll({
      organizationId: user.organizationId,
      actorUserId: user.userId,
      payrollPeriodId: String(formData.get('payrollPeriodId') ?? ''),
    });
    revalidatePath('/dashboard/payroll');
    const unchanged = result.existingCount ? ` ${result.existingCount} existing immutable ${result.existingCount === 1 ? 'entry was' : 'entries were'} unchanged.` : '';
    return {
      success: `${result.createdCount} payroll ${result.createdCount === 1 ? 'entry' : 'entries'} generated.${unchanged}`,
      setupErrors: result.setupErrors,
    };
  } catch (error) { return failure(error); }
}

export async function createPayrollPolicyAction(_state: PayrollActionState, formData: FormData): Promise<PayrollActionState> {
  const user = await requireBackOfficeContext();
  if (!canManagePayroll(user)) return { error: 'Unauthorized to manage payroll policy.' };
  try {
    const leaveTreatments = [...formData.entries()]
      .filter(([key]) => key.startsWith('leaveTreatment:'))
      .map(([key, value]) => ({ leaveTypeId: key.slice('leaveTreatment:'.length), treatment: String(value) }));
    const policy = await createPayrollPolicy({
      organizationId: user.organizationId, actorUserId: user.userId,
      effectiveFrom: String(formData.get('effectiveFrom') ?? ''), effectiveTo: String(formData.get('effectiveTo') ?? '') || null,
      dailyPayBasis: String(formData.get('dailyPayBasis') ?? ''),
      lateDeductionRule: String(formData.get('lateDeductionRule') ?? ''), lateDeductionParameter: String(formData.get('lateDeductionParameter') ?? ''),
      absenceDeductionRule: String(formData.get('absenceDeductionRule') ?? ''), absenceDeductionParameter: String(formData.get('absenceDeductionParameter') ?? ''),
      undertimeDeductionRule: String(formData.get('undertimeDeductionRule') ?? ''), undertimeDeductionParameter: String(formData.get('undertimeDeductionParameter') ?? ''),
      roundingRule: String(formData.get('roundingRule') ?? ''), leaveTreatments,
    });
    revalidatePath('/dashboard/payroll');
    return { success: `Payroll policy version ${policy.version} created.` };
  } catch (error) { return failure(error); }
}

export async function movePayrollToReviewAction(_state: PayrollActionState, formData: FormData): Promise<PayrollActionState> {
  const user = await requireBackOfficeContext();
  if (!canManagePayroll(user)) return { error: 'Unauthorized to review payroll.' };
  try {
    await movePayrollPeriodToReview({ organizationId: user.organizationId, actorUserId: user.userId, payrollPeriodId: String(formData.get('payrollPeriodId') ?? '') });
    revalidatePath('/dashboard/payroll');
    return { success: 'Payroll period moved to review.' };
  } catch (error) { return failure(error); }
}

export async function finalizePayrollAction(_state: PayrollActionState, formData: FormData): Promise<PayrollActionState> {
  const user = await requireBackOfficeContext();
  if (!canManagePayroll(user)) return { error: 'Unauthorized to finalize payroll.' };
  try {
    await finalizePayrollPeriod({
      organizationId: user.organizationId, actorUserId: user.userId,
      payrollPeriodId: String(formData.get('payrollPeriodId') ?? ''), confirmation: String(formData.get('confirmation') ?? ''),
    });
    revalidatePath('/dashboard/payroll');
    return { success: 'Payroll finalized and locked.' };
  } catch (error) { return failure(error); }
}

export async function deletePayrollPeriodAction(_state: PayrollActionState, formData: FormData): Promise<PayrollActionState> {
  const user = await requireBackOfficeContext();
  if (!canManagePayroll(user)) return { error: 'Unauthorized to delete payroll periods.' };
  try {
    const payrollPeriodId = String(formData.get('payrollPeriodId') ?? '');
    await deletePayrollPeriod({
      organizationId: user.organizationId,
      actorUserId: user.userId,
      payrollPeriodId,
    });
    revalidatePath('/dashboard/payroll');
    return { success: 'Payroll period deleted successfully.' };
  } catch (error) { return failure(error); }
}

export async function deletePayrollPeriodDirectAction(payrollPeriodId: string): Promise<{ success?: string; error?: string }> {
  const user = await requireBackOfficeContext();
  if (!canManagePayroll(user)) return { error: 'Unauthorized to delete payroll periods.' };
  try {
    await deletePayrollPeriod({
      organizationId: user.organizationId,
      actorUserId: user.userId,
      payrollPeriodId,
    });
    revalidatePath('/dashboard/payroll');
    return { success: 'Payroll period deleted successfully.' };
  } catch (error) {
    return { error: error instanceof PayrollError ? error.message : error instanceof Error ? error.message : 'The payroll period could not be deleted.' };
  }
}

