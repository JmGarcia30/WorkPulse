'use client';

import { useActionState, useState } from 'react';
import { saveStatutorySetupAction, saveTaxOpeningAction } from '@/features/payroll/actions';
import type { PayrollStatutorySetupRow } from '@/features/payroll/setup-queries';
import type { StatutoryPayrollInput } from '@/features/payroll/statutory-inputs';
import { StatusMessage } from './PayrollSetupForms';

const inputClass = 'min-w-0 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-normal';
const buttonClass = 'rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50';
const amountProps = { type: 'number', min: '0', max: '9999999999.99', step: '0.01', required: true } as const;
const openingFields = [
  ['riceExemptUsedThisMonth', 'Rice exemption used in opening payment month'], ['laundryExemptUsedThisMonth', 'Laundry exemption used in opening payment month'],
  ['clothingExemptUsedThisYear', 'Clothing exemption used in payment year'], ['otherBenefitsGrossPaidYtd', 'Other benefits paid YTD (shared annual pool)'],
  ['taxableCompensationYtd', 'Taxable compensation YTD'], ['withholdingTaxYtd', 'Withholding tax YTD'],
] as const;
const earningKinds = ['FIXED_ALLOWANCE', 'OVERTIME', 'COMMISSION', 'THIRTEENTH_MONTH', 'QUALIFYING_OTHER_BENEFIT', 'RICE_SUBSIDY', 'CLOTHING_ALLOWANCE', 'LAUNDRY_ALLOWANCE'] as const;

function CoverageField({ agency, saved }: { agency: 'SSS' | 'PHILHEALTH' | 'PAGIBIG'; saved?: StatutoryPayrollInput['coverage']['SSS'] }) {
  const [status, setStatus] = useState(saved?.status ?? '');
  return <div className="min-w-0 space-y-2 rounded-xl border bg-white p-3"><label className="grid gap-1 text-xs font-semibold">{agency === 'PHILHEALTH' ? 'PhilHealth' : agency === 'PAGIBIG' ? 'Pag-IBIG' : agency} coverage<select name={`coverage.${agency}`} required value={status} onChange={event => setStatus(event.target.value as typeof status)} className={inputClass}><option value="">Resolve coverage</option><option value="MANDATORY">Mandatory employee coverage</option><option value="EXEMPT">Reviewed exemption</option></select></label>{status === 'EXEMPT' && <><label className="grid gap-1 text-xs">Exemption legal basis<input name={`legalBasis.${agency}`} required defaultValue={saved?.status === 'EXEMPT' ? saved.legalBasis : ''} className={inputClass} /></label><label className="grid gap-1 text-xs">Exemption evidence reference<input name={`evidence.${agency}`} required defaultValue={saved?.status === 'EXEMPT' ? saved.evidenceReference : ''} className={inputClass} /></label></>}</div>;
}

function PeriodInputs({ row, periodId }: { row: PayrollStatutorySetupRow; periodId: string }) {
  const [state, action, pending] = useActionState(saveStatutorySetupAction, {});
  const values = row.input ?? row.reusable?.payload;
  const [earnings, setEarnings] = useState<StatutoryPayrollInput['additionalEarnings']>(values?.additionalEarnings ?? []);
  const [deductions, setDeductions] = useState<StatutoryPayrollInput['otherNetDeductions']>(values?.otherNetDeductions ?? []);
  const [fields, setFields] = useState({
    monthlySssRemuneration: values?.monthlySssRemuneration ?? '', monthlyPhilHealthBasic: values?.monthlyPhilHealthBasic ?? (row.compensation?.compensationType === 'MONTHLY' ? row.compensation.baseRate : ''), monthlyPagIbigFundSalary: values?.monthlyPagIbigFundSalary ?? '',
    agencyBasisReference: values?.agencyBasisReference ?? '', unionDues: values?.unionDues.amount ?? '', unionReference: values?.unionDues.reference ?? '', evidenceReference: row.inputEvidence || row.reusable?.evidenceReference || '',
    late: values?.companyDeductionTreatment.late ?? '', absence: values?.companyDeductionTreatment.absence ?? '', undertime: values?.companyDeductionTreatment.undertime ?? '',
  });
  const edit = (key: keyof typeof fields, value: string) => setFields(current => ({ ...current, [key]: value }));
  // A validation response must not reset the employee's reviewed input values.
  return <form action={action} aria-busy={pending} onReset={event => event.preventDefault()} onSubmit={event => { if (!window.confirm('Save these reviewed statutory inputs for this employee and payroll period? They become locked when payroll is generated.')) event.preventDefault(); }} className="space-y-4">
    {pending ? <p role="status" className="text-xs text-slate-600">Saving reviewed statutory inputs…</p> : <StatusMessage state={state} />}<input type="hidden" name="employeeId" value={row.id} /><input type="hidden" name="payrollPeriodId" value={periodId} />
    <input type="hidden" name="additionalEarnings" value={JSON.stringify(earnings)} /><input type="hidden" name="otherNetDeductions" value={JSON.stringify(deductions)} />
    <fieldset disabled={pending || row.inputLocked} className="min-w-0 space-y-4 disabled:opacity-70">
      <legend className="mb-3 text-sm font-bold">Reviewed period inputs</legend>
      {row.inputLocked && <p className="text-xs text-slate-600">Locked: this period already has an immutable payroll entry. Adjustment/reconciliation requires a separate reviewed workflow.</p>}
      <div className="grid gap-3 sm:grid-cols-3">{([['monthlySssRemuneration', 'SSS monthly remuneration'], ['monthlyPhilHealthBasic', 'PhilHealth full monthly basic salary'], ['monthlyPagIbigFundSalary', 'Pag-IBIG monthly Fund Salary']] as const).map(([name, label]) => <label key={name} className="grid gap-1 text-xs font-semibold">{label}<input {...amountProps} name={name} value={fields[name]} onChange={event => edit(name, event.target.value)} className={inputClass} /></label>)}</div>
      <p className="text-xs text-slate-600">Enter reviewed full-month bases, including for semi-monthly cutoffs. PhilHealth uses basic salary before attendance deductions. PhilHealth is prefilled only for fixed monthly compensation and must be reviewed. SSS and Pag-IBIG require their own remuneration mapping; they are not assumed equal to basic salary.</p>
      <label className="grid gap-1 text-xs font-semibold">Agency basis evidence reference<input name="agencyBasisReference" required value={fields.agencyBasisReference} onChange={event => edit('agencyBasisReference', event.target.value)} className={inputClass} /></label>
      <div className="grid gap-3 sm:grid-cols-3">{(['SSS', 'PHILHEALTH', 'PAGIBIG'] as const).map(agency => <CoverageField key={agency} agency={agency} saved={values?.coverage[agency]} />)}</div>
      <div className="grid gap-3 sm:grid-cols-3">{(['late', 'absence', 'undertime'] as const).map(key => <label key={key} className="grid gap-1 text-xs font-semibold capitalize">{key} deduction treatment<select name={`treatment.${key}`} required value={fields[key]} onChange={event => edit(key, event.target.value)} className={inputClass}><option value="">Review treatment</option><option value="SALARY_REDUCTION">Salary not earned (reduces taxable earnings)</option><option value="NET_DEDUCTION">Net deduction (does not reduce taxable earnings)</option></select></label>)}</div>
      <section className="space-y-3"><h4 className="text-xs font-bold">Additional classified cash earnings</h4><p className="text-xs text-slate-500">Basic salary is supplied by compensation. Add all additional cash earnings here. Benefit exemptions require entitlement evidence.</p>
        {earnings.map((earning, index) => <div key={index} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-2"><label className="grid gap-1 text-xs">Earning reference<input required aria-label={`Earning ${index + 1} reference`} value={earning.id} onChange={event => setEarnings(earnings.map((item, i) => i === index ? { ...item, id: event.target.value } : item))} className={inputClass} /></label><label className="grid gap-1 text-xs">Classification<select value={earning.kind} onChange={event => setEarnings(earnings.map((item, i) => i === index ? { ...item, kind: event.target.value as typeof item.kind } : item))} className={inputClass}>{earningKinds.map(kind => <option key={kind} value={kind}>{kind.replaceAll('_', ' ')}</option>)}</select></label><label className="grid gap-1 text-xs">Amount<input {...amountProps} value={earning.amount} onChange={event => setEarnings(earnings.map((item, i) => i === index ? { ...item, amount: event.target.value } : item))} className={inputClass} /></label><label className="grid gap-1 text-xs">Qualification evidence<input required={!['FIXED_ALLOWANCE', 'OVERTIME', 'COMMISSION'].includes(earning.kind)} value={earning.qualificationReference ?? ''} onChange={event => setEarnings(earnings.map((item, i) => i === index ? { ...item, qualificationReference: event.target.value || undefined } : item))} className={inputClass} /></label><button type="button" onClick={() => setEarnings(earnings.filter((_, i) => i !== index))} className="text-left text-xs font-semibold text-red-700">Remove earning {index + 1}</button></div>)}
        <button type="button" onClick={() => setEarnings([...earnings, { id: `earning-${earnings.length + 1}`, kind: 'FIXED_ALLOWANCE', amount: '' }])} className="text-xs font-bold text-teal-800">Add earning</button>
      </section>
      <div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-xs font-semibold">Employee union dues (enter reviewed 0 if none)<input {...amountProps} name="unionDues" value={fields.unionDues} onChange={event => edit('unionDues', event.target.value)} className={inputClass} /></label><label className="grid gap-1 text-xs font-semibold">Union dues evidence reference<input name="unionReference" required value={fields.unionReference} onChange={event => edit('unionReference', event.target.value)} className={inputClass} /></label></div>
      <section className="space-y-3"><h4 className="text-xs font-bold">Other employee net deductions</h4><p className="text-xs text-slate-500">Loans or voluntary savings only. Do not enter employer contributions or repeat attendance deductions.</p>{deductions.map((deduction, index) => <div key={index} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-3"><label className="grid gap-1 text-xs">Deduction reference<input required value={deduction.id} onChange={event => setDeductions(deductions.map((item, i) => i === index ? { ...item, id: event.target.value } : item))} className={inputClass} /></label><label className="grid gap-1 text-xs">Amount<input {...amountProps} value={deduction.amount} onChange={event => setDeductions(deductions.map((item, i) => i === index ? { ...item, amount: event.target.value } : item))} className={inputClass} /></label><label className="grid gap-1 text-xs">Evidence<input required value={deduction.reference} onChange={event => setDeductions(deductions.map((item, i) => i === index ? { ...item, reference: event.target.value } : item))} className={inputClass} /></label><button type="button" onClick={() => setDeductions(deductions.filter((_, i) => i !== index))} className="text-left text-xs font-semibold text-red-700">Remove deduction {index + 1}</button></div>)}<button type="button" onClick={() => setDeductions([...deductions, { id: `deduction-${deductions.length + 1}`, amount: '', reference: '' }])} className="text-xs font-bold text-teal-800">Add net deduction</button></section>
      <label className="grid gap-1 text-xs font-semibold">Review evidence reference<input name="evidenceReference" required value={fields.evidenceReference} onChange={event => edit('evidenceReference', event.target.value)} className={inputClass} /></label>
      <div className="space-y-3 rounded-xl bg-slate-50 p-3 text-xs">{([
        ['profileReviewed', 'I verified a resident citizen/resident alien, private rank-and-file, single-employer, full-month employee who is not MWE; no previous employer this year, cumulative method, annualization or final payment is required.'],
        ['historyReviewed', 'I verified there are no untracked contributions for this contribution month. Any earlier cutoff is in the persisted ledger.'],
        ['earningsReviewed', 'I reviewed all cash earnings, agency bases, coverage, exemptions and company deduction treatments. Empty additional lists mean none are payable.'],
      ] as const).map(([name, label]) => <label key={name} className="flex items-start gap-2"><input type="checkbox" name={name} value="CONFIRMED" required className="mt-0.5 shrink-0" /><span>{label}</span></label>)}</div>
      <button disabled={pending || row.inputLocked} className={buttonClass}>{pending ? 'Saving reviewed inputs…' : 'Save reviewed period inputs'}</button>
    </fieldset>
  </form>;
}

function TaxOpening({ row, payDate }: { row: PayrollStatutorySetupRow; payDate: string }) {
  const [state, action, pending] = useActionState(saveTaxOpeningAction, {});
  const [fields, setFields] = useState<Record<string, string>>({ ...Object.fromEntries(openingFields.map(([key]) => [key, row.opening?.balances[key] ?? ''])), openingPayDate: row.opening?.payDate ?? payDate, evidenceReference: row.opening?.evidence ?? '' });
  const edit = (key: string, value: string) => setFields(current => ({ ...current, [key]: value }));
  return <form action={action} aria-busy={pending} onReset={event => event.preventDefault()} onSubmit={event => { if (!window.confirm('Confirm the complete historical amounts before this opening payment date were independently reviewed. Save this opening history?')) event.preventDefault(); }} className="space-y-4 border-t pt-4">
    {pending ? <p role="status" className="text-xs text-slate-600">Saving verified opening history…</p> : <StatusMessage state={state} />}<input type="hidden" name="employeeId" value={row.id} />
    <fieldset disabled={pending || row.openingLocked} className="space-y-3 disabled:opacity-70"><legend className="mb-3 text-sm font-bold">Verified opening history · {payDate.slice(0, 4)}</legend>
      <p className="text-xs text-slate-600">Enter complete verified history before the opening payment date. Monthly benefit usage belongs to that payment month. Amounts are never inferred from old payslips. Enter 0 only when verified.</p>
      {row.openingLocked && <p className="text-xs font-semibold text-slate-600">Opening history is read-only after use or finalization. Subsequent totals come from persisted payments.</p>}
      <label className="grid gap-1 text-xs font-semibold">Opening payment date<input name="openingPayDate" type="date" required min={`${payDate.slice(0, 4)}-01-01`} max={payDate} value={fields.openingPayDate} onChange={event => edit('openingPayDate', event.target.value)} className={inputClass} /></label>
      <div className="grid gap-3 sm:grid-cols-2">{openingFields.map(([name, label]) => <label key={name} className="grid gap-1 text-xs font-semibold">{label}<input {...amountProps} name={name} value={fields[name]} onChange={event => edit(name, event.target.value)} className={inputClass} /></label>)}</div>
      <label className="grid gap-1 text-xs font-semibold">Historical ledger / review evidence<input name="evidenceReference" required value={fields.evidenceReference} onChange={event => edit('evidenceReference', event.target.value)} className={inputClass} /></label>
      <label className="flex items-start gap-2 text-xs"><input type="checkbox" name="openingReviewed" value="CONFIRMED" required className="mt-0.5" /><span>I reviewed the complete history before this payment date, including all prior benefits, taxable compensation and withholding, and verified every zero balance.</span></label>
      <button disabled={pending || row.openingLocked} className={buttonClass}>{pending ? 'Saving verified history…' : 'Save verified opening history'}</button>
    </fieldset>
  </form>;
}

export function PayrollStatutorySetupPanel({ rows, periodId, periodName, payDate }: { rows: PayrollStatutorySetupRow[]; periodId: string; periodName: string; payDate: string }) {
  const [employeeId, setEmployeeId] = useState(rows[0]?.id ?? '');
  const row = rows.find(item => item.id === employeeId);
  return <section id="statutory-setup" className="min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
    <div><h2 className="text-base font-bold">Statutory setup · {periodName}</h2><p className="mt-1 text-xs text-slate-600">Review period inputs and payment-year opening history before generation. Saving setup is followed by the existing calculation and finalization checks.</p></div>
    <ul className="grid gap-2 sm:grid-cols-2">{rows.map(item => <li key={item.id}><button type="button" onClick={() => setEmployeeId(item.id)} aria-pressed={item.id === employeeId} className={`w-full rounded-xl border p-3 text-left text-xs ${item.id === employeeId ? 'border-teal-600 bg-teal-50' : 'border-slate-200'}`}><span className="block font-bold">{item.employeeNumber} · {item.firstName} {item.lastName}</span><span className="mt-1 block">{item.input ? 'Period inputs saved' : 'Review government setup'} · {item.opening ? 'Opening history saved' : 'Verify opening history'}</span>{(item.inputLocked || item.openingLocked) && <span className="mt-1 block text-slate-500">Used records are read-only</span>}</button></li>)}</ul>
    {row ? <div key={`${periodId}-${row.id}`} className="space-y-6"><h3 className="text-sm font-bold">{row.employeeNumber} · {row.firstName} {row.lastName}</h3><PeriodInputs row={row} periodId={periodId} /><TaxOpening row={row} payDate={payDate} /></div> : <p className="text-xs text-slate-500">No active employees are available for setup.</p>}
  </section>;
}
