import { SeparationType } from '@prisma/client';
import type { CaseDetails } from '../domain';

export const fieldClass = 'block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm';
export const label = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^./, c => c.toUpperCase());

export function Field({ name, title, value, required = false, type = 'text', readOnly = false }: { name: string; title: string; value?: string | null; required?: boolean; type?: string; readOnly?: boolean }) {
  return <label className="block text-sm font-medium">{title}<input className={fieldClass} name={name} type={type} defaultValue={value ?? ''} required={required} readOnly={readOnly} maxLength={type === 'date' ? undefined : 2000} /></label>;
}

export function CaseFields({ details, employeeNotice = false }: { details?: CaseDetails; employeeNotice?: boolean }) {
  return <div className="grid gap-3 sm:grid-cols-2">
    <label className="block text-sm font-medium">Separation type<select className={fieldClass} name="separationType" disabled={employeeNotice} defaultValue={details?.separationType ?? 'RESIGNATION'}>{Object.values(SeparationType).map(type => <option key={type}>{type}</option>)}</select>{employeeNotice && <input type="hidden" name="separationType" value="RESIGNATION" />}</label>
    <Field name="reason" title="Reason / supporting explanation" value={details?.reason} required readOnly={employeeNotice} />
    <Field name="noticeDate" title="Written notice date (resignation only)" type="date" value={details?.noticeDate} readOnly={employeeNotice} />
    <Field name="proposedLastWorkingDay" title="Proposed last working day" type="date" value={details?.proposedLastWorkingDay} required readOnly={employeeNotice} />
    <Field name="proposedEffectiveDate" title="Effective separation date (after last working day)" type="date" value={details?.proposedEffectiveDate} required readOnly={employeeNotice} />
    <Field name="noticeRemarks" title="Notice remarks (resignation only)" value={details?.noticeRemarks} />
    <Field name="administrativeRemarks" title="Administrative remarks / document references" value={details?.administrativeRemarks} />
  </div>;
}
