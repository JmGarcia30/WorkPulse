'use client';

import { useActionState } from 'react';
import type { OrganizationResignationPolicy } from '../policy';
import { saveResignationPolicyAction } from '../policy-actions';
import { fieldClass } from './Fields';

export function PolicySettingsForm({ policy }: { policy: OrganizationResignationPolicy | null }) {
  const [state, action, pending] = useActionState(saveResignationPolicyAction, {});
  return <form action={action} className="space-y-4">
    <fieldset disabled={pending} className="space-y-4 disabled:opacity-60">
      <label className="block text-sm font-medium">Required notice period
        <input name="noticePeriod" type="number" min="0" max="3650" step="1" required defaultValue={policy?.noticePeriod} className={fieldClass} />
      </label>
      <label className="block text-sm font-medium">Notice unit
        <select name="noticeUnit" defaultValue={policy?.noticeUnit ?? 'CALENDAR_DAYS'} className={fieldClass}>
          <option value="CALENDAR_DAYS">Calendar days</option><option value="CALENDAR_MONTHS">Calendar months</option>
        </select>
      </label>
      <p className="text-sm text-slate-600">Use a whole number: 0–3650 days or 0–120 months. Calendar months clamp to month end. Zero means no minimum elapsed notice; a written notice date is still recorded.</p>
      <label className="block text-sm"><input name="allowExceptions" type="checkbox" defaultChecked={policy?.allowExceptions ?? true} /> Allow authorized short-notice exceptions with a recorded justification</label>
      <button type="submit" className="wp-button-primary">{pending ? 'Saving…' : 'Save resignation policy'}</button>
    </fieldset>
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-green-800">{state.success}</p>}
  </form>;
}
