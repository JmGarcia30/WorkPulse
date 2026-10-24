'use server';

import { revalidatePath } from 'next/cache';
import * as service from './service';
import { SeparationError } from './domain';
import { FINAL_PAY_KINDS } from './final-pay-domain';

export type FinalPayActionState = { error?: string; success?: string };
export async function finalPayAction(_previous: FinalPayActionState, form: FormData): Promise<FinalPayActionState> {
  const value = (key: string) => typeof form.get(key) === 'string' ? String(form.get(key)) : '';
  const version = { caseId: value('caseId'), expectedVersion: Number(value('expectedVersion') || 'NaN') };
  try {
    switch (value('finalPayOperation')) {
      case 'create': await service.createFinalPay(version.caseId); break;
      case 'save': await service.saveFinalPayDraft({ ...version, deadlineDays: Number(value('deadlineDays') || 'NaN'), deadlineBasis: value('deadlineBasis'), payload: {
        lines: FINAL_PAY_KINDS.map(kind => ({ kind, disposition: value(`${kind}.disposition`), first: value(`${kind}.first`), second: value(`${kind}.second`), basis: value(`${kind}.basis`) })),
        coverageConfirmed: value('coverageConfirmed') === 'on', taxReviewed: value('taxReviewed') === 'on', reconciliationConfirmed: value('reconciliationConfirmed') === 'on', reviewNotes: value('reviewNotes'),
      } }); break;
      case 'review': await service.reviewFinalPay({ ...version, confirmed: value('confirmed') === 'on' }); break;
      case 'approve':
        if (value('confirmed') !== 'on') return { error: 'Explicitly confirm final-pay approval.' };
        await service.approveFinalPay({ ...version, decision: 'APPROVE_FINAL_PAY', remarks: value('remarks') }); break;
      case 'payment': await service.recordFinalPayPayment({ caseId: version.caseId, requestKey: value('requestKey'), amount: value('amount'), paidOn: value('paidOn'), reference: value('reference'), remarks: value('remarks'), confirmed: value('confirmed') === 'on' }); break;
      case 'deadlinePolicy': await service.saveFinalPayDeadlinePolicy({ days: Number(value('days') || 'NaN'), basis: value('basis') }); break;
      default: return { error: 'Unknown final-pay operation.' };
    }
    revalidatePath('/dashboard/employees/exit', 'layout');
    revalidatePath('/dashboard/settings/exit');
    return { success: 'Final-pay record saved. No bank transfer was initiated.' };
  } catch (error) {
    return { error: error instanceof SeparationError ? error.message : 'Unable to process final pay. Reload and check your HR access before retrying.' };
  }
}
