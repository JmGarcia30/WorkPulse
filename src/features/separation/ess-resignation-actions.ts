'use server';
import { revalidatePath } from 'next/cache';
import { submitEmployeeResignation } from './ess-resignation-service';
import { SeparationError } from './domain';

export type ResignationActionState = { error?: string; success?: string };
export async function submitResignationAction(_previous: ResignationActionState, form: FormData): Promise<ResignationActionState> {
  const allowed = new Set(['requestKey', 'reason', 'proposedLastWorkingDay', 'proposedEffectiveDate', 'confirmed']);
  for (const key of form.keys()) if (!allowed.has(key) && !key.startsWith('$ACTION_')) return { error: 'Unexpected resignation field. Reload the form; employee and organization identity are resolved from your session.' };
  const value = (key: string) => typeof form.get(key) === 'string' ? String(form.get(key)) : '';
  try {
    const result = await submitEmployeeResignation({ requestKey: value('requestKey'), reason: value('reason'), proposedLastWorkingDay: value('proposedLastWorkingDay'), proposedEffectiveDate: value('proposedEffectiveDate'), confirmed: value('confirmed') === 'on' });
    revalidatePath('/employee/resignation');
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/employees/exit', 'layout');
    return { success: result.alreadySubmitted ? 'This notice was already recorded. Its processing status is shown below.' : 'Your resignation notice is recorded and HR has been notified in Requires Attention. Acknowledgment records receipt; it is not acceptance or rejection of your notice.' };
  } catch (error) {
    return { error: error instanceof SeparationError ? error.message : 'Unable to submit your notice. Check your current employee access and reload before retrying.' };
  }
}
