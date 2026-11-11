'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, CalendarDays, Calculator, Check, Clock3, Coins, FileText, ShieldCheck, UserRound } from 'lucide-react';
import { saveEmployeePayrollConfigurationAction } from '@/features/payroll/actions';
import { StatusMessage } from './PayrollSetupForms';
import { TenantLink } from '@/components/ui/TenantLink';

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
type Payline = { label: string; amount: string | null; quantity?: string | null; unit?: string; rate?: string | null; rateUnit?: string | null; kind?: string };
export type PayrollCalculatedPreview = {
  status: string; base: string; gross: string; totalDeductions: string; net: string;
  statutory: Payline[]; attendance: Payline[]; incentives: Payline[];
};
export type PayrollAttendanceDay = {
  date: string; status: string; lateSeconds: number; undertimeSeconds: number; overtimeSeconds: number; disposition: string;
};

type Props = {
  employees: Employee[];
  periods: Period[];
  compensations: Compensation[];
  coverage: Coverage[];
  initialEmployeeId?: string;
  initialPeriodId?: string;
  calculation?: PayrollCalculatedPreview | null;
  attendanceDays?: PayrollAttendanceDay[];
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


type TimeUnit = 'hour' | 'minute';
function convertRate(value: string, from: TimeUnit, to: TimeUnit): string {
  if (value.trim() === '' || from === to) return value;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  const converted = from === 'hour' ? amount / 60 : amount * 60;
  return String(Number(converted.toFixed(4)));
}
function storedRate(value: string, displayUnit: TimeUnit, canonicalUnit: TimeUnit): string {
  if (!value.trim()) return '';
  const n = Number(value) * (displayUnit === canonicalUnit ? 1 : displayUnit === 'minute' ? 60 : 1 / 60);
  return Number.isFinite(n) ? n.toFixed(2) : '';
}
function TimeRateField({ label, name, value, onChange, unit, changeUnit, canonicalUnit }: {
  label: string; name: string; value: string; onChange: (next: string) => void;
  unit: TimeUnit; changeUnit: (next: TimeUnit) => void; canonicalUnit: TimeUnit;
}) {
  return <div className="min-w-0 space-y-1.5">
    <label htmlFor={name + '-display'} className="block text-xs font-semibold text-[#282934]">{label}</label>
    <div className="flex min-w-0 gap-1">
      <span className="relative min-w-0 flex-1">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-semibold">₱</span>
        <input id={name + '-display'} className={inputClass + ' pl-7'} type="number" min="0.0001" step="0.0001" inputMode="decimal" required value={value} onChange={event => onChange(event.target.value)} />
      </span>
      <select aria-label={label + ' unit'} value={unit} onChange={event => changeUnit(event.target.value as TimeUnit)} className="w-[89px] shrink-0 rounded-lg border border-[#dedde0] bg-white px-1 text-xs text-[#282934]">
        <option value="hour">/ hour</option><option value="minute">/ minute</option>
      </select>
    </div>
    <input type="hidden" name={name} value={storedRate(value, unit, canonicalUnit)} />
    <p className="text-[11px] text-[#6d7382]">Calculated using recorded {unit === 'minute' ? 'minutes' : 'hours'}</p>
  </div>;
}

export function PayrollSimpleConfiguration({ employees, periods, compensations, coverage, initialEmployeeId, initialPeriodId, calculation, attendanceDays = [] }: Props) {
  const [state, action, pending] = useActionState(saveEmployeePayrollConfigurationAction, {});
  const router = useRouter();
  const pathname = usePathname();
  const changeSelection = (periodId: string, nextEmployeeId: string) => {
    router.replace(pathname + '?tab=configuration&period=' + encodeURIComponent(periodId) + '&employee=' + encodeURIComponent(nextEmployeeId), { scroll: false });
  };
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
  const [overtimeUnit, setOvertimeUnit] = useState<TimeUnit>('hour');
  const [undertimeUnit, setUndertimeUnit] = useState<TimeUnit>('hour');
  const [lateUnit, setLateUnit] = useState<TimeUnit>('minute');
  useEffect(() => {
    setStart(initialPeriod?.periodStart ?? '');
    setEnd(initialPeriod?.periodEnd ?? '');
  }, [initialPeriod?.id, initialPeriod?.periodStart, initialPeriod?.periodEnd]);
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
    setOvertimeUnit('hour');
    setUndertimeUnit('hour');
    setLateUnit('minute');
  }, [active?.id, active?.baseRate, active?.overtimePayPerHour, active?.undertimeDeductionPerHour, active?.lateDeductionPerMinute, active?.absenceDeductionPerDay, active?.notifyOnPayslipReady, employeeId]);

  const deductions = [
    { label: 'SSS', checked: !!verified?.sss },
    { label: 'PhilHealth', checked: !!verified?.philHealth },
    { label: 'Pag-IBIG', checked: !!verified?.pagIbig },
    { label: 'BIR Withholding Tax', checked: !!verified?.bir },
  ];
  const allVerified = deductions.every(d => d.checked);
  const isFocused = employeeId === (initialEmployeeId || employees[0]?.id) && period?.id === initialPeriod?.id;
  const savedCalculation = isFocused ? calculation : null;
  const rate = (value: string, unit: TimeUnit) => peso(value) + (unit === 'hour' ? '/hr' : '/min');
  const moneyRows = savedCalculation?.attendance ?? [];
  const money = (value: string | null) => {
    if (!value) return '—';
    if (/^₱\s*[\d,]+\.\d{2}$/.test(value)) return value;
    return peso(value);
  };

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
            <label className="flex flex-col gap-1.5 text-xs font-semibold">Start Date<input className={inputClass} type="date" value={start} onChange={event => { const next = event.target.value; setStart(next); const match = periods.find(row => row.periodStart === next && row.periodEnd === end); if (match) changeSelection(match.id, employeeId); }} required /></label>
            <label className="flex flex-col gap-1.5 text-xs font-semibold">End Date<input className={inputClass} type="date" value={end} min={start} onChange={event => { const next = event.target.value; setEnd(next); const match = periods.find(row => row.periodStart === start && row.periodEnd === next); if (match) changeSelection(match.id, employeeId); }} required /></label>
          </div>
          {period ? <p className="mt-2 text-xs text-[#6d7382] sm:pl-16">{period.name} · {period.status}</p> :
            <p role="alert" className="mt-2 text-xs font-medium text-amber-800 sm:pl-16">These dates do not match an existing cutoff. Choose a saved payroll period before calculating.</p>}
        </section>

        <section className={card}>
          <Heading icon={UserRound} title="Employee" description="Select the employee and set their salary and deductions." />
          <div className="sm:pl-16"><label className="sr-only" htmlFor="payroll-config-employee">Employee</label>
            <select id="payroll-config-employee" className={inputClass} value={employeeId} onChange={event => { setEmployeeId(event.target.value); if (period) changeSelection(period.id, event.target.value); }} required>
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
            <TimeRateField label="Overtime Pay" name="overtimePayPerHour" value={overtime} onChange={setOvertime} unit={overtimeUnit} canonicalUnit="hour" changeUnit={next => { setOvertime(convertRate(overtime, overtimeUnit, next)); setOvertimeUnit(next); }} />
            <TimeRateField label="Undertime Deduction" name="undertimeDeductionPerHour" value={undertime} onChange={setUndertime} unit={undertimeUnit} canonicalUnit="hour" changeUnit={next => { setUndertime(convertRate(undertime, undertimeUnit, next)); setUndertimeUnit(next); }} />
            <TimeRateField label="Late Deduction" name="lateDeductionPerMinute" value={late} onChange={setLate} unit={lateUnit} canonicalUnit="minute" changeUnit={next => { setLate(convertRate(late, lateUnit, next)); setLateUnit(next); }} />
            <AmountField label="Absence Deduction" unit="Per day" name="absenceDeductionPerDay" value={absence} onChange={setAbsence} />
          </div>
          <p className="mt-3 text-[11px] text-[#6d7382]">Amounts must follow authorized salary and Philippine wage rules. The system validates entered rates; holiday/rest-day overtime needs separate review.</p>
        </section>
        <section className={card}>
          <Heading icon={Clock3} color="blue" title="Actual Attendance" description="Attendance recorded by WorkPulse for the selected employee and cutoff." />
          {isFocused && attendanceDays.length > 0 ? <div className="max-h-56 overflow-auto">
            <table className="min-w-full text-xs">
              <thead className="sticky top-0 bg-white text-left"><tr><th className="p-2">Date</th><th className="p-2">Status</th><th className="p-2 text-right">Late</th><th className="p-2 text-right">Undertime</th><th className="p-2 text-right">Overtime</th></tr></thead>
              <tbody>{attendanceDays.map(day => <tr key={day.date} className="border-t border-[#efedeb]">
                <td className="p-2">{dateLabel(day.date)}</td><td className="p-2">{day.status.replaceAll('_',' ')}{day.disposition === 'APPROVED_LEAVE' ? ' (Leave)' : ''}</td>
                <td className="p-2 text-right">{(day.lateSeconds / 60).toFixed(2)} min</td>
                <td className="p-2 text-right">{(day.undertimeSeconds / 60).toFixed(2)} min</td>
                <td className="p-2 text-right">{(day.overtimeSeconds / 60).toFixed(2)} min</td>
              </tr>)}</tbody>
            </table>
          </div> : <p className="text-xs text-[#686878]">No attendance records are available for this employee and cutoff. Recorded attendance is required before calculating adjustments.</p>}
          <p className="mt-3 text-[11px] text-[#777781]">Payroll uses verified attendance; these are not manually entered payroll totals.</p>
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
            <p>OT: {rate(overtime, overtimeUnit)}</p><p>Undertime: {rate(undertime, undertimeUnit)}</p><p>Late: {rate(late, lateUnit)}</p><p>Absence: {peso(absence)}/day</p>
          </dd></div>
          <div className="flex justify-between gap-3 py-3"><dt className="font-medium">Notify Employee</dt><dd className={'rounded-full px-2.5 py-1 font-semibold ' + (notify ? 'bg-[#e5f8e8] text-green-800' : 'bg-slate-100 text-slate-600')}>{notify ? 'Enabled' : 'Disabled'}</dd></div>
        </dl>
        <div className="mt-4 rounded-xl bg-[#faf8f6] p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold">Payroll Calculation</h3>
            {savedCalculation && <span className="text-[11px] font-semibold">{savedCalculation.status}</span>}
          </div>
          {savedCalculation ? <div className="mt-3 space-y-2 text-xs">
            <div className="flex justify-between gap-3"><span>Cutoff Base Pay</span><strong>{money(savedCalculation.base)}</strong></div>
            {savedCalculation.incentives.map((item, i) => <div key={i} className="flex justify-between gap-2 text-emerald-700"><span>{item.label}</span><strong>+{money(item.amount)}</strong></div>)}
            {moneyRows.map((item, i) => <div key={i} className="flex justify-between gap-2"><span>{item.label}{item.quantity ? ' · ' + item.quantity + ' ' + (item.unit ?? '') : ''}</span><strong>{item.kind === 'earning' ? '+' : '−'}{money(item.amount)}</strong></div>)}
            {savedCalculation.statutory.map((item, i) => <div key={i} className="flex justify-between gap-2"><span>{item.label}</span><strong>−{money(item.amount)}</strong></div>)}
            <div className="flex justify-between gap-2 border-t pt-2"><span>Gross Pay</span><strong>{money(savedCalculation.gross)}</strong></div>
            <div className="flex justify-between gap-2"><span>Total Deductions</span><strong>{money(savedCalculation.totalDeductions)}</strong></div>
            <div className="flex justify-between gap-2 rounded-lg bg-[#fff0cf] p-2 text-sm"><strong>Net Pay</strong><strong>{money(savedCalculation.net)}</strong></div>
            <p className="text-[11px] text-[#696978]">Amounts are from the saved payroll calculation, not estimates. Review before finalizing.</p>
          </div> : <p className="mt-2 text-xs text-[#696978]">Save the employee configuration, then calculate this cutoff below to see earnings, incentives, deductions and net pay here.</p>}
        </div>
        <button type="submit" disabled={pending || !period || period.status === 'FINALIZED' || !employeeId || !employees.length} className="mt-5 w-full rounded-lg bg-[#282934] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#41434f] disabled:cursor-not-allowed disabled:opacity-50">{pending ? 'Saving…' : 'Save Configuration'}</button>
        <div className="mt-3 hidden xl:block"><StatusMessage state={state} /></div>
        {period && employee && <TenantLink className="mt-3 block text-center text-xs font-semibold text-[#282934] underline underline-offset-2" href={'/dashboard/payroll/reports/employee?period=' + encodeURIComponent(period.id) + '&employee=' + encodeURIComponent(employee.id)}>View employee calculation report</TenantLink>}

      </aside>
    </form>
  </div>;
}
