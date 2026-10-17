'use server';

import { revalidatePath } from 'next/cache';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { canManageSeparation } from '@/lib/permissions/rbac';
import * as service from './service';
import { SeparationError } from './domain';
import { ClearanceStatus, SeparationReviewKind, SeparationType } from '@prisma/client';

export type ExitActionState = { error?: string; success?: string; caseId?: string };

export async function separationAction(_previous: ExitActionState, form: FormData): Promise<ExitActionState> {
  // Actions are public endpoints: authorize independently of page visibility.
  const actor = await requireBackOfficeContext().catch(() => null);
  if (!actor || !canManageSeparation(actor)) return { error: 'Separation administration requires an authorized HR or organization administrator account in this organization.' };
  const value = (key: string) => typeof form.get(key) === 'string' ? String(form.get(key)) : '';
  const optional = (key: string) => value(key).trim() || undefined;
  const version = { caseId: value('caseId'), expectedVersion: Number(value('expectedVersion') || 'NaN') };
  const details = () => ({ separationType: value('separationType') as SeparationType, reason: value('reason'),
    noticeDate: optional('noticeDate'), proposedLastWorkingDay: optional('proposedLastWorkingDay'),
    proposedEffectiveDate: optional('proposedEffectiveDate'), noticeRemarks: optional('noticeRemarks'), administrativeRemarks: optional('administrativeRemarks') });
  try {
    let result: { id: string };
    switch (value('operation')) {
      case 'create': result = await service.createSeparationCase({ ...details(), employeeId: value('employeeId'), requestKey: value('requestKey'), inactiveEmployeeJustification: optional('inactiveEmployeeJustification') }); break;
      case 'update': result = await service.updateSeparationCase({ ...version, details: details(), status: 'IN_PROGRESS' }); break;
      case 'clearance': result = await service.recordClearanceDecision({ ...version, itemId: value('itemId'), status: value('status') as ClearanceStatus, remarks: optional('remarks'), verified: value('verified') === 'on' }); break;
      case 'addItem': result = await service.addClearanceItem({ ...version, requestKey: value('requestKey'), item: { category: value('category'), title: value('title'), description: optional('description'), responsibleUnit: optional('responsibleUnit'), isRequired: value('isRequired') === 'on' } }); break;
      case 'review': result = await service.recordSeparationReview({ ...version, kind: value('kind') as SeparationReviewKind, evidence: value('evidence'), verified: value('verified') === 'on' }); break;
      case 'exception': result = await service.recordNoticeException({ ...version, reason: value('reason') }); break;
      case 'cancel': result = await service.cancelSeparationCase({ ...version, reason: value('reason') }); break;
      case 'ready': result = await service.markReadyForFinalReview(version); break;
      case 'approve':
        if (value('confirmed') !== 'on') return { error: 'Confirm the approval decision before submitting.' };
        result = await service.approveSeparationCase({ ...version, decision: 'APPROVE_SEPARATION', remarks: value('remarks'), backdatedJustification: optional('backdatedJustification'), inactiveEmployeeJustification: optional('inactiveEmployeeJustification') }); break;
      case 'execute':
        if (value('confirmed') !== 'on') return { error: 'Confirm final separation and ESS access termination before executing.' };
        result = await service.executeSeparation({ ...version, remarks: value('remarks'), backdatedJustification: optional('backdatedJustification') }); break;
      default: return { error: 'Unknown separation action.' };
    }
    revalidatePath('/dashboard/employees/exit', 'layout');
    return { success: 'Saved. The latest case information is shown below.', caseId: result.id };
  } catch (error) {
    if (error instanceof SeparationError) return { error: error.code === 'CONFLICT' ? 'This case changed. Reload the page and review the latest information before submitting again.' : error.message };
    console.error('Separation action failed', error instanceof Error ? error.name : 'UnknownError');
    return { error: 'Unable to save this action. Reload the case before trying again.' };
  }
}
