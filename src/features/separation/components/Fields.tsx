import { SeparationType } from '@prisma/client';
import type { CaseDetails } from '../domain';

export const fieldClass = 'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm';
export const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^./, c => c.toUpperCase());

export function Field({ name, title, value, required = false, type = 'text' }: { name: string; title: string; value?: string | null; required?: boolean; type?: string }) {
  return <label className="block text-sm font-medium">{title}<input className={fieldClass} name={name} type={type} defaultValue={value ?? ''} required={required} maxLength={type === 'date' ? undefined : 2000} /></label>;
}

export function CaseFields({ details }: { details?: CaseDetails }) {
  return <div className="grid gap-3 sm:grid-cols-2">
    <label className="block text-sm font-medium">Separation type<select className={fieldClass} name="separationType" defaultValue={details?.separationType ?? 'RESIGNATION'}>{Object.values(SeparationType).map(type => <option key={type}>{type}</option>)}</select></label>
    <Field name="reason" title="Reason / supporting explanation" value={details?.reason} required />
    <Field name="noticeDate" title="Written notice date (resignation only)" type="date" value={details?.noticeDate} />
    <Field name="proposedLastWorkingDay" title="Proposed last working day" type="date" value={details?.proposedLastWorkingDay} required />
    <Field name="proposedEffectiveDate" title="Effective separation date (after last working day)" type="date" value={details?.proposedEffectiveDate} required />
    <Field name="noticeRemarks" title="Notice remarks (resignation only)" value={details?.noticeRemarks} />
    <Field name="administrativeRemarks" title="Administrative remarks / document references" value={details?.administrativeRemarks} />
  </div>;
}
