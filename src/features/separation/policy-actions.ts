'use server';

import { revalidatePath } from 'next/cache';
import { saveResignationPolicy } from './service';
import { SeparationError } from './domain';

export type PolicyActionState = { error?: string; success?: string };

export async function saveResignationPolicyAction(_previous: PolicyActionState, form: FormData): Promise<PolicyActionState> {
  try {
    // Identity and current HR role are resolved independently by the service.
    // Reject unexpected fields instead of accepting tenant/actor overrides.
    const allowed = new Set(['noticePeriod', 'noticeUnit', 'allowExceptions']);
    for (const key of form.keys()) {
      if (!allowed.has(key) && !key.startsWith('$ACTION_')) return { error: 'Unexpected policy field.' };
    }
    const period = form.get('noticePeriod');
    await saveResignationPolicy({
      noticePeriod: typeof period === 'string' && period.trim() ? Number(period) : Number.NaN,
      noticeUnit: form.get('noticeUnit'), allowExceptions: form.get('allowExceptions') === 'on',
    });
    revalidatePath('/dashboard/settings/exit');
    revalidatePath('/dashboard/employees/exit', 'layout');
    return { success: 'Resignation policy saved. Existing configured cases retain their policy. For a case awaiting configuration, save its editable case details to apply this policy.' };
  } catch (error) {
    return { error: error instanceof SeparationError ? error.message : 'Unable to save resignation policy. Check your HR Administrator access and try again.' };
  }
}
