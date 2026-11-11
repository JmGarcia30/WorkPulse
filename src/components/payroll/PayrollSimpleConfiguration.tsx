'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { Bell, CalendarDays, Calculator, Check, Clock3, Coins, FileText, ShieldCheck, UserRound } from 'lucide-react';
import { saveEmployeePayrollConfigurationAction } from '@/features/payroll/actions';
import { StatusMessage } from './PayrollSetupForms';

type Employee = { id: string; employeeNumber: string; firstName: string; lastName: string };
type Period = { id: string; name: string; periodStart: string; periodEnd: string; status: string };
type Compensation = {
  id: string;
  employeeId: string;
  baseRate: string;
  currency: string;
  compensationType: string;
  payFrequency: string;
  status: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  overtimePayPerHour: string | null;
  undertimeDeductionPerHour: string | null;
  lateDeductionPerMinute: string | null;
  absenceDeductionPerDay: string | null;
  notifyOnPayslipReady: boolean;
};
type Coverage = { employeeId: string; periodId: string; sss: boolean; philHealth: boolean; pagIbig: boolean; bir: boolean };

type Props = {
  employees: Employee[];
  periods: Period[];
  compensations: Compensation[];
  coverage: Coverage[];
  initialEmployeeId?: string;
  initialPeriodId?: string;
};

const card = 'rounded-2xl border border-[#e6e5e4] bg-white p-4 shadow-[0_2px_14px_rgba(40,41,52,0.035)] sm:p-5';
const inputClass = 'min-w-0 w-full rounded-lg border border-[#dedde0] bg-white px-3 py-2.5 text-sm text-[#282934] outline-none focus:border-[#b5a25b] focus:ring-2 focus:ring-[#fcefc9]';
const peso = (value: string) => value && Number.isFinite(Number(value))
  ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value))
  : 'Not set';
const dateLabel = (value: string) => value
  ? new Date(value + 'T00:00:00.000Z').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  : 'Not selected';

function Heading({ icon: Icon, title, description, color = 'slate' }: {
  icon: typeof CalendarDays; title: string; description: string; color?: 'slate' | 'gold' | 'purple' | 'blue' | 'green';
}) {
  const tones = {
    slate: 'bg-[#f0f3f8] text-[#282934]',
    gold: 'bg-[#fff4dd] text-[#d58b00]',
    purple: 'bg-[#f3ecff] text-[#7038b7]',
    blue: 'bg-[#eef6fd] text-[#2b6f9c]',
    green: 'bg-[#ebfaf0] text-[#179144]',
  };
  return <div className="mb-4 flex items-start gap-3">
    <span className={'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ' + tones[color]}><Icon className="h-5 w-5" aria-hidden="true" /></span>
    <div><h2 className="text-base font-bold text-[#282934]">{title}</h2><p className="mt-0.5 text-xs text-[#656574]">{description}</p></div>
  </div>;
}

function AmountField({ label, unit, name, value, onChange }: {
  label: string; unit: string; name: string; value: string; onChange: (next: string) => void;
}) {
  return <label className="flex min-w-0 flex-col gap-1.5">
    <span className="text-xs font-semibold text-[#282934]">{label}</span>
    <span className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-bold text-[#454551]">₱</span>
      <input className={inputClass + ' pl-8'} name={name} type="number" min="0.01" max="9999999999.99" step="0.01" inputMode="decimal" required value={value} onChange={event => onChange(event.target.value)} placeholder="0.00" />
    </span>
    <span className="text-[11px] text-[#6d7382]">{unit}</span>
  </label>;
}

export function PayrollSimpleConfiguration({ employees, periods, compensations, coverage, initialEmployeeId, initialPeriodId }: Props) {
  const [state, action, pending] = useActionState(saveEmployeePayrollConfigurationAction, {});
  const initialPeriod = periods.find(p => p.id === initialPeriodId) ?? periods[0];
  const [start, setStart] = useState(initialPeriod?.periodStart ?? '');
  const [end, setEnd] = useState(initialPeriod?.periodEnd ?? '');
  const [employeeId, setEmployeeId] = useState(initialEmployeeId && employees.some(e => e.id === initialEmployeeId) ? initialEmployeeId : employees[0]?.id ?? '');
  const period = useMemo(() => periods.find(p => p.periodStart === start && p.periodEnd === end), [periods, start, end]);
  const [salary, setSalary] = useState('');
  const [overtime, setOvertime] = useState('');
  const [undertime, setUndertime] = useState('');
  const [late, setLate] = useState('');
  const [absence, setAbsence] = useState('');
  const [notify, setNotify] = useState(true);
  const active = useMemo(() => compensations
    .filter(c => c.employeeId === employeeId && c.status === 'ACTIVE' && c.effectiveFrom <= start && (!c.effectiveTo || c.effectiveTo >= end))
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0], [compensations, employeeId, start, end]);
  const employee = employees.find(e => e.id === employeeId);
  const verified = coverage.find(c => c.employeeId === employeeId && c.periodId === period?.id);
  useEffect(() => {
    setSalary(active?.baseRate ?? '');
    setOvertime(active?.overtimePayPerHour ?? '');
    setUndertime(active?.undertimeDeductionPerHour ?? '');
    setLate(active?.lateDeductionPerMinute ?? '');
    setAbsence(active?.absenceDeductionPerDay ?? '');
    setNotify(active?.notifyOnPayslipReady ?? true);
  }, [active?.id, active?.baseRate, active?.overtimePayPerHour, active?.undertimeDeductionPerHour, active?.lateDeductionPerMinute, active?.absenceDeductionPerDay, active?.notifyOnPayslipReady, employeeId]);

  const deductions = [
    { label: 'SSS', checked: !!verified?.sss },
    { label: 'PhilHealth', checked: !!verified?.philHealth },
    { label: 'Pag-IBIG', checked: !!verified?.pagIbig },
    { label: 'BIR Withholding Tax', checked: !!verified?.bir },
  ];
  const allVerified = deductions.every(d => d.checked);

  return <div className="space-y-5 text-[#282934]">
    <header><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Payroll Configuration</h1><p className="mt-1 text-sm text-[#626271]">Set up the payroll details, salary, deductions, and attendance rules.</p></header>
    <form action={action} aria-busy={pending} className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(300px,1fr)]">
      <input type="hidden" name="payrollPeriodId" value={period?.id ?? ''} />
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="notifyOnPayslipReady" value={notify ? 'on' : 'off'} />
      <div className="min-w-0 space-y-3.5">
        <section className={card}>
          <Heading icon={CalendarDays} color="gold" title="Payroll Coverage" description="Set the payroll period for this computation." />
          <div className="grid gap-3 sm:pl-16 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-xs font-semibold">Start Date<input className={inputClass} type="date" value={start} onChange={event => setStart(event.target.value)} required /></label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold">End Date<input className={inputClass} type="date" value={end} min={start} onChange={event => setEnd(event.target.value)} required /></label>
          </div>
          {period ? <p className="mt-2 text-xs text-[#6d7382] sm:pl-16">{period.name} · {period.status}</p> :
            <p role="alert" className="mt-2 text-xs font-medium text-amber-800 sm:pl-16">These dates do not match a saved payroll cutoff. Create the cutoff under Run Payroll first.</p>}
        </section>

        <section className={card}>
          <Heading icon={UserRound} title="Employee" description="Select the employee and set their salary and deductions." />
          <div className="sm:pl-16"><label className="sr-only" htmlFor="payroll-config-employee">Employee</label>
            <select id="payroll-config-employee" className={inputClass} value={employeeId} onChange={event => setEmployeeId(event.target.value)} required>
              <option value="">Select employee</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.employeeNumber} — {e.firstName} {e.lastName}</option>)}
            </select>
          </div>
        </section>

        <div className="grid gap-3.5 md:grid-cols-2">
          <section className={card}>
            <Heading icon={Coins} color="gold" title="Base Salary" description="Monthly salary of the selected employee." />
            <AmountField label="Monthly Base Salary" unit="Full monthly salary before deductions" name="monthlyBaseSalary" value={salary} onChange={setSalary} />
          </section>
          <section className={card}>
            <Heading icon={ShieldCheck} color="purple" title="PH Statutory Deductions" description="Government contributions are calculated automatically." />
            <div className="grid gap-2">
              {deductions.map(d => <div className="flex items-center gap-2.5 text-xs font-medium" key={d.label}>
                <span aria-label={d.checked ? 'Verified' : 'Requires verification'} className={'flex h-[17px] w-[17px] items-center justify-center rounded-[5px] border ' + (d.checked ? 'border-[#282934] bg-[#282934] text-white' : 'border-slate-300 bg-white')}><Check className={d.checked ? 'h-3 w-3' : 'hidden'} /></span>{d.label}
              </div>)}
              {!allVerified && <p className="mt-1 text-[11px] text-amber-800">Unverified information requires HR review before calculation. No deductions are estimated.</p>}
            </div>
          </section>
        </div>

        <section className={card}>
          <Heading icon={Clock3} color="blue" title="Attendance Rules" description="Set the peso value of attendance adjustments. Actual attendance comes from WorkPulse." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <AmountField label="Overtime Pay" unit="Per hour" name="overtimePayPerHour" value={overtime} onChange={setOvertime} />
            <AmountField label="Undertime Deduction" unit="Per hour" name="undertimeDeductionPerHour" value={undertime} onChange={setUndertime} />
            <AmountField label="Late Deduction" unit="Per minute" name="lateDeductionPerMinute" value={late} onChange={setLate} />
            <AmountField label="Absence Deduction" unit="Per day" name="absenceDeductionPerDay" value={absence} onChange={setAbsence} />
          </div>
          <p className="mt-3 text-[11px] text-[#6d7382]">Amounts must follow authorized salary and Philippine wage rules. The system validates entered rates; holiday/rest-day overtime needs separate review.</p>
        </section>
        <section className={card}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ebfaf0] text-[#169344]"><Bell className="h-5 w-5" /></span>
              <div><h2 className="text-base font-bold">Employee Notification</h2><p className="mt-1 text-xs text-[#686878]">Allow HR to notify the employee after the payslip is finalized in ESS.</p></div>
            </div>
            <button aria-label="Enable employee notification" type="button" role="switch" aria-checked={notify} onClick={() => setNotify(!notify)} className={'relative h-7 w-12 shrink-0 rounded-full transition ' + (notify ? 'bg-[#282934]' : 'bg-slate-300')}><span className={'absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ' + (notify ? 'left-6' : 'left-1')} /></button>
          </div>
        </section>
        <div className="xl:hidden"><StatusMessage state={state} /></div>
      </div>
      <aside className={card + ' xl:sticky xl:top-6'}>
        <div className="relative mx-auto mb-3 flex h-40 max-w-xs items-center justify-center overflow-hidden rounded-xl bg-[#fffaf0]">
          <div className="absolute h-32 w-32 rounded-full bg-[#fff0ce] blur-lg" />
          <div className="relative flex h-28 w-24 -rotate-6 flex-col gap-2 rounded-lg border-2 border-[#282934] bg-white p-3 shadow-md">
            <strong className="text-center text-sm">PAYSLIP</strong>
            <span className="h-1 rounded-full bg-slate-300" /><span className="h-1 rounded-full bg-slate-300" /><span className="h-1 w-3/4 rounded-full bg-slate-300" />
            <FileText className="ml-auto mt-auto h-5 w-5 text-[#c48a0a]" />
          </div>
          <div className="relative -ml-3 mt-12 flex h-20 w-16 rotate-6 flex-col items-center justify-center rounded-md border-2 border-[#282934] bg-[#ffe1a1] shadow-md">
            <Calculator className="h-12 w-12 text-[#282934]" />
          </div>
        </div>
        <h2 className="text-lg font-bold">Configuration Summary</h2>
        <dl className="mt-2 divide-y divide-[#eeecea] text-xs">
          <div className="flex justify-between gap-3 py-3"><dt className="font-medium">Employee</dt><dd className="text-right font-semibold">{employee ? employee.firstName + ' ' + employee.lastName : 'Not selected'}</dd></div>
          <div className="flex justify-between gap-3 py-3"><dt className="font-medium">Payroll Period</dt><dd className="text-right font-semibold">{dateLabel(start)} – {dateLabel(end)}</dd></div>
          <div className="flex justify-between gap-3 py-3"><dt className="font-medium">Base Salary</dt><dd className="text-right font-semibold">{peso(salary)}</dd></div>
          <div className="flex justify-between gap-3 py-3"><dt className="font-medium">Statutory Deductions</dt><dd className="text-right font-semibold">{allVerified ? 'SSS, PhilHealth, Pag-IBIG, BIR' : 'Verification required'}</dd></div>
          <div className="flex justify-between gap-3 py-3"><dt className="font-medium">Attendance Rules</dt><dd className="space-y-1 text-right font-semibold">
            <p>OT: {peso(overtime)}/hr</p><p>Undertime: {peso(undertime)}/hr</p><p>Late: {peso(late)}/min</p><p>Absence: {peso(absence)}/day</p>
          </dd></div>
          <div className="flex justify-between gap-3 py-3"><dt className="font-medium">Notify Employee</dt><dd className={'rounded-full px-2.5 py-1 font-semibold ' + (notify ? 'bg-[#e5f8e8] text-green-800' : 'bg-slate-100 text-slate-600')}>{notify ? 'Enabled' : 'Disabled'}</dd></div>
        </dl>
        <button type="submit" disabled={pending || !period || period.status === 'FINALIZED' || !employeeId || !employees.length} className="mt-5 w-full rounded-lg bg-[#282934] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#41434f] disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Saving…' : 'Save Configuration'}</button>
        <div className="mt-3 hidden xl:block"><StatusMessage state={state} /></div>
        {period && employee && <a className="mt-3 block text-center text-xs font-semibold text-[#282934] underline underline-offset-2" href={'/dashboard/payroll?period=' + encodeURIComponent(period.id) + '&employee=' + encodeURIComponent(employee.id)}>View employee calculation report</a>}
        {!allVerified && <a className="mt-2 block text-center text-[11px] text-[#6d7382] underline" href={'/dashboard/payroll/settings?tab=advanced&period=' + encodeURIComponent(period?.id ?? '') + '&employee=' + encodeURIComponent(employeeId)}>Review statutory exceptions</a>}
      </aside>
    </form>
  </div>;
}
