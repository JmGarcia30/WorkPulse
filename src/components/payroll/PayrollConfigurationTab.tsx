'use client';

import { useState } from 'react';
import type { PayrollStatutorySetupRow } from '@/features/payroll/setup-queries';
import { PayrollStatutorySetupPanel, TaxOpening } from './PayrollStatutorySetupPanel';
import { PayrollReuseSetup } from './PayrollReuseSetup';
import { StandardPayrollProfile } from './StandardPayrollProfile';
import { PayrollOvertimeApprovalForm } from './PayrollOvertimeApprovalForm';
import { CompensationForm, CompensationUpdateForm, PayrollPeriodForm, PayrollPolicyForm } from './PayrollSetupForms';
import { formatPayrollDate } from '@/features/payroll/formatters';
import { CalendarDays, UserRound, Wallet, ShieldCheck, Clock3, Bell, FileText } from 'lucide-react';

interface EmployeeItem { id: string; employeeNumber: string; firstName: string; lastName: string; }
interface CompensationItem {
  id: string; employeeId: string; compensationType: string; baseRate: string; currency: string;
  payFrequency: string; effectiveFrom: Date; effectiveTo: Date | null; status: string;
  employee: { employeeNumber: string; firstName: string; lastName: string };
}
interface PolicyItem {
  id: string; version: number; effectiveFrom: Date; effectiveTo: Date | null; status: string;
  dailyPayBasis: string; lateDeductionRule: string; absenceDeductionRule: string; notifyEmployeesOnFinalization?: boolean;
  undertimeDeductionRule: string; roundingRule: string; createdBy: { name: string };
  leaveTreatments: Array<{ leaveTypeId: string; treatment: string }>; 
}
interface LeaveTypeItem { id: string; code: string; name: string; isPaid: boolean; }
interface Props {
  employees: EmployeeItem[]; compensations: CompensationItem[]; policies: PolicyItem[];
  currentPolicy: PolicyItem | null; leaveTypes: LeaveTypeItem[];
  statutorySetup?: Array<PayrollStatutorySetupRow & { inputVersion: string }> | null;
  selectedPeriod?: { id: string; name: string; payDate: Date; periodStart?: Date; periodEnd?: Date } | null;
  payrollEntryExists?: boolean;
  compensationRevisions?: Array<{ id: string; reason: string; createdAt: Date; actor: { name: string } }>;
  selectedEmployeeId?: string;
}

const card = 'rounded-2xl border border-[#e7e5e2] bg-white p-5 shadow-sm';
const label = 'mb-1 block text-xs font-semibold text-[#424452]';
const input = 'w-full rounded-xl border border-[#deddd9] bg-white px-3 py-2.5 text-sm text-[#282934] outline-none focus:border-[#282934]';

export function PayrollConfigurationTab({ employees, compensations, policies, currentPolicy, leaveTypes, statutorySetup, selectedPeriod, selectedEmployeeId, payrollEntryExists = false, compensationRevisions = [] }: Props) {
  const [employeeId, setEmployeeId] = useState(selectedEmployeeId ?? employees[0]?.id ?? '');
  const selected = employees.find(row => row.id === employeeId);
  const compensation = compensations.find(row => row.employeeId === employeeId && row.status === 'ACTIVE');
  const setup = statutorySetup?.find(row => row.id === employeeId);
  const money = (value?: string | null) => value ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value)) : 'Not configured';
  return <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,0.9fr)] text-[#282934]">
    <div className="space-y-4">
      <section className={card}>
        <div className="mb-4 flex items-center gap-3"><span className="rounded-xl bg-amber-50 p-3 text-amber-600"><CalendarDays className="h-5 w-5"/></span><div><h2 className="font-bold">Payroll Coverage</h2><p className="text-xs text-slate-500">Set the start and end dates for this payroll computation.</p></div></div>
        {selectedPeriod ? <div className="grid gap-3 sm:grid-cols-2"><div><span className={label}>Start Date</span><div className={input}>{formatPayrollDate(selectedPeriod.periodStart)}</div></div><div><span className={label}>End Date</span><div className={input}>{formatPayrollDate(selectedPeriod.periodEnd)}</div></div><p className="text-xs text-slate-500 sm:col-span-2">Selected cutoff: {selectedPeriod.name}. Pay date: {formatPayrollDate(selectedPeriod.payDate)}.</p></div> : <p className="text-sm text-amber-800">Create a payroll period to set its coverage dates.</p>}
        <details className="mt-4 border-t pt-3"><summary className="cursor-pointer text-sm font-semibold">Create a payroll cutoff</summary><PayrollPeriodForm/></details>
      </section>

      <section className={card}>
        <div className="mb-4 flex items-center gap-3"><span className="rounded-xl bg-blue-50 p-3 text-blue-700"><UserRound className="h-5 w-5"/></span><div><h2 className="font-bold">Employee</h2><p className="text-xs text-slate-500">Select the employee whose salary and payroll settings you are configuring.</p></div></div>
        <form action="/dashboard/payroll/settings" method="get" className="flex flex-col gap-2 sm:flex-row"><input type="hidden" name="tab" value="configuration"/>{selectedPeriod && <input type="hidden" name="period" value={selectedPeriod.id}/>}<select name="employee" value={employeeId} onChange={e=>setEmployeeId(e.target.value)} className={input}>{employees.map(person=><option key={person.id} value={person.id}>{person.employeeNumber} — {person.firstName} {person.lastName}</option>)}</select><button className="shrink-0 rounded-xl bg-[#282934] px-4 py-2.5 text-sm font-semibold text-white">Load Employee</button></form>
      </section>

      <section className={card}>
        <div className="mb-3 flex items-center gap-3"><span className="rounded-xl bg-amber-50 p-3 text-amber-600"><Wallet className="h-5 w-5"/></span><div><h2 className="font-bold">Base Salary</h2><p className="text-xs text-slate-500">Monthly salary of the selected employee.</p></div></div>
        {compensation ? <div className="mb-3 rounded-xl bg-slate-50 p-3 text-sm"><span className="text-xs text-slate-500">Current monthly base salary</span><p className="text-xl font-bold">{money(compensation.baseRate)}</p><p className="text-xs text-slate-500">Effective {formatPayrollDate(compensation.effectiveFrom)}{compensation.effectiveTo ? ' to '+formatPayrollDate(compensation.effectiveTo) : ' onward'}</p></div> : <p className="mb-3 text-xs text-amber-800">No active salary record covers this employee yet.</p>}
        {selected && !compensation && <CompensationForm employees={[selected]} profiles={setup ? [setup] : []} selectedEmployeeId={selected.id}/>}{selected && compensation && <CompensationUpdateForm employeeId={selected.id} compensation={compensation}/>}
      {compensationRevisions.length > 0 && <details className="mt-3 rounded-xl border bg-white p-3"><summary className="cursor-pointer text-xs font-semibold">Salary change history ({compensationRevisions.length})</summary><ul className="mt-3 space-y-2">{compensationRevisions.map(item => <li key={item.id} className="border-t pt-2 text-xs"><p className="font-semibold">{item.reason}</p><p className="mt-1 text-slate-500">{item.actor.name} · {formatPayrollDate(item.createdAt)}</p></li>)}</ul></details>}</section>

      <section className={card}>
        <div className="mb-3 flex items-center gap-3"><span className="rounded-xl bg-violet-50 p-3 text-violet-700"><ShieldCheck className="h-5 w-5"/></span><div><h2 className="font-bold">PH Statutory Deductions</h2><p className="text-xs text-slate-500">Mandatory deductions are calculated using verified employee details and current statutory rules.</p></div></div>
        <div className="grid gap-2 sm:grid-cols-2">{['SSS','PhilHealth','Pag-IBIG','BIR Withholding Tax'].map(name=><div key={name} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm"><ShieldCheck className="h-4 w-4 text-emerald-600"/><span>{name}</span><span className="ml-auto text-xs text-slate-500">Automatic</span></div>)}</div>
        <p className="mt-3 text-xs text-slate-500">HR reviews employee coverage and supporting information. Do not switch off a legally required contribution to bypass payroll validation.</p>
        {statutorySetup && selectedPeriod && <details className="mt-3 border-t pt-3"><summary className="cursor-pointer text-sm font-semibold">Review employee statutory information</summary><div className="mt-3">{setup ? <StandardPayrollProfile rows={[setup]} periodId={selectedPeriod.id}/> : <p className="text-xs text-slate-500">Select a payroll cutoff to review this employee.</p>}</div></details>}
      </section>

      <section className={card}>
        <div className="mb-3 flex items-center gap-3"><span className="rounded-xl bg-blue-50 p-3 text-blue-700"><Clock3 className="h-5 w-5"/></span><div><h2 className="font-bold">Attendance Rules</h2><p className="text-xs text-slate-500">Set monetary values in Philippine pesos, not percentages.</p></div></div>
        {currentPolicy && <div className="mb-3 rounded-xl bg-slate-50 p-3 text-xs"><p className="font-semibold">Active policy · Version {currentPolicy.version}</p><p className="mt-1 text-slate-500">Effective {formatPayrollDate(currentPolicy.effectiveFrom)}{currentPolicy.effectiveTo ? ' – '+formatPayrollDate(currentPolicy.effectiveTo) : ' onward'} · Notifications {('notifyEmployeesOnFinalization' in currentPolicy && currentPolicy.notifyEmployeesOnFinalization) ? 'on' : 'off'}</p></div>}<PayrollPolicyForm leaveTypes={leaveTypes} compact currentTreatments={currentPolicy?.leaveTreatments ?? []} defaultNotifyEmployees={currentPolicy?.notifyEmployeesOnFinalization ?? false}/>
        <p className="mt-3 text-xs text-slate-500">Late and undertime amounts are configured per minute; absence is configured per day or per occurrence. Overtime is added only when HR records an approved amount and supporting evidence.</p>
        {setup?.input && selectedPeriod && <details className="mt-3 border-t pt-3"><summary className="cursor-pointer text-sm font-semibold">Add approved overtime</summary><PayrollOvertimeApprovalForm employeeId={employeeId} periodId={selectedPeriod.id} expectedVersion={setup.inputVersion} input={{monthlySssRemuneration: setup.input.monthlySssRemuneration, monthlyPagIbigFundSalary: setup.input.monthlyPagIbigFundSalary}} hasEntry={payrollEntryExists}/></details>}
      </section>

      <section className={card}>
        <div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-50 p-3 text-emerald-700"><Bell className="h-5 w-5"/></span><div><h2 className="font-bold">Employee Notification</h2><p className="text-xs text-slate-500">After payroll is finalized, HR can notify the employee that their payslip is available in My Payroll (ESS).</p></div><span className="ml-auto rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Available after finalization</span></div>
      </section>
      <details className="rounded-2xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-semibold">Advanced payroll records and statutory history</summary><div className="mt-4 space-y-4">{statutorySetup && selectedPeriod ? <><PayrollReuseSetup rows={setup ? [setup] : []} periodId={selectedPeriod.id}/><PayrollStatutorySetupPanel rows={setup ? [setup] : []} periodId={selectedPeriod.id} periodName={selectedPeriod.name} payDate={selectedPeriod.payDate.toISOString().slice(0,10)}/>{setup && <TaxOpening row={setup} payDate={selectedPeriod.payDate.toISOString().slice(0,10)}/>}</> : <p className="text-xs text-slate-500">Select a payroll period first.</p>}</div></details>
    </div>
    <aside className="xl:sticky xl:top-5">
      <section className={card}>
        <div className="mb-5 flex h-40 items-center justify-center rounded-2xl bg-[#fff7e5]"><div className="text-center"><FileText className="mx-auto h-16 w-16 text-amber-600"/><p className="mt-2 text-sm font-bold tracking-wide">PAYSLIP</p><p className="text-xs text-slate-500">WorkPulse Payroll</p></div></div>
        <h2 className="mb-4 text-lg font-bold">Configuration Summary</h2>
        <dl className="divide-y divide-slate-100 text-sm">
          <div className="flex justify-between gap-3 py-3"><dt className="text-slate-500">Employee</dt><dd className="text-right font-semibold">{selected ? selected.firstName+' '+selected.lastName : 'Not selected'}</dd></div>
          <div className="flex justify-between gap-3 py-3"><dt className="text-slate-500">Payroll Period</dt><dd className="text-right font-semibold">{selectedPeriod ? selectedPeriod.name : 'Not selected'}</dd></div>
          <div className="flex justify-between gap-3 py-3"><dt className="text-slate-500">Base Salary</dt><dd className="text-right font-semibold">{money(compensation?.baseRate)}</dd></div>
          <div className="flex justify-between gap-3 py-3"><dt className="text-slate-500">Statutory</dt><dd className="text-right font-semibold">SSS, PhilHealth, Pag-IBIG, BIR</dd></div>
          <div className="flex justify-between gap-3 py-3"><dt className="text-slate-500">Attendance</dt><dd className="text-right font-semibold">{currentPolicy ? 'Configured' : 'Needs setup'}</dd></div>
          <div className="flex justify-between gap-3 py-3"><dt className="text-slate-500">Notification</dt><dd className="text-right font-semibold">After finalization</dd></div>
        </dl>
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">Saving salary and attendance rules updates the configuration used by payroll calculations. Finalized payroll records remain unchanged.</p>
      </section>
    </aside>
  </div>;
}
