'use client';

import { useState } from 'react';
import type { PayrollDashboardEntryItem } from '@/features/payroll/queries';
import { TenantLink } from '@/components/ui/TenantLink';
import { PayrollDeductionBreakdown } from './PayrollDeductionBreakdown';
import { PayrollEarningsForm, type EarningsEmployee } from './PayrollEarningsForm';

export function PayrollReviewTable({ entries, selectedPeriodName, isPeriodFinalized, earningsEmployees = [], periodId }: {
  entries: PayrollDashboardEntryItem[]; selectedPeriodName?: string; isPeriodFinalized: boolean; earningsEmployees?: EarningsEmployee[]; periodId?: string;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const filtered = entries.filter(row => `${row.firstName} ${row.lastName} ${row.employeeNumber}`.toLowerCase().includes(query.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 8, currentPage * 8);
  return <div className="space-y-4">
    <label className="grid gap-1 text-sm">Find an employee<input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} className="wp-input" placeholder="Employee name or number" /></label>
    <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
      <caption className="sr-only">Payroll review for {selectedPeriodName ?? 'selected period'}</caption>
      <thead><tr>{['Employee', 'Basic Pay', 'Additional Earnings', 'Gross Pay', 'Deductions', 'Net Pay', 'Status'].map(label => <th scope="col" key={label} className="p-3">{label}</th>)}</tr></thead>
      <tbody>{visible.map(entry => <tr key={entry.id} className="border-t align-top">
        <th scope="row" className="p-3"><a href={`#payroll-detail-${entry.id}`} onClick={() => setExpanded(entry.id)} className="underline">{entry.firstName} {entry.lastName}</a><span className="block text-xs font-normal">{entry.employeeNumber}</span></th>
        <td className="p-3">{entry.baseAmountFormatted}</td>
        <td className="p-3">{entry.additionalEarnings?.length ? entry.additionalEarnings.map(row => <p key={row.id}>{row.description ?? row.kind}: {entry.currency} {row.amount}</p>) : 'None recorded'}</td>
        <td className="p-3">{entry.grossAmountFormatted}</td><td className="p-3">{entry.totalDeductionsFormatted}</td><td className="p-3 font-bold">{entry.netAmountFormatted}</td><td className="p-3">{entry.status}<p className="text-xs text-amber-900">{entry.issueMessage}</p></td>
      </tr>)}</tbody>
    </table></div>
    {!filtered.length && <p className="text-sm text-slate-600">{entries.length ? 'No employees match this search.' : 'Generate payroll to review employee amounts here.'}</p>}
    {pages > 1 && <nav aria-label="Payroll employees" className="flex items-center gap-3 text-sm"><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="wp-button-secondary">Previous</button><span>Page {currentPage} of {pages}</span><button type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)} className="wp-button-secondary">Next</button></nav>}
    {visible.map(entry => {
      const editor = earningsEmployees.find(row => row.id === entry.employeeId);
      return <section id={`payroll-detail-${entry.id}`} key={entry.id} className="scroll-mt-6 rounded-xl border p-4">
        <details open={expanded === entry.id} onToggle={event => { if (event.currentTarget.open) setExpanded(entry.id); else setExpanded(current => current === entry.id ? null : current); }}><summary className="cursor-pointer font-semibold">{entry.firstName} {entry.lastName} · Salary and attendance breakdown</summary>
          <div className="mt-4 space-y-3 text-sm"><p>Salary: {entry.baseRateFormatted} · {entry.payFrequency.replaceAll('_', ' ').toLowerCase()}. Basic pay for this period: {entry.baseAmountFormatted}.</p>
            <p>{entry.attendanceSummary ? `${entry.attendanceSummary.presentDays ?? 0} present · ${entry.attendanceSummary.lateOccurrences ?? 0} late · ${entry.attendanceSummary.absentDays ?? 0} absent · ${entry.leaveSummary?.approvedDays ?? entry.attendanceSummary.approvedLeaveDays ?? 0} approved leave` : 'Attendance snapshot unavailable.'}</p>
            {entry.breakdown && <PayrollDeductionBreakdown breakdown={entry.breakdown} currency={entry.currency} />}
            <p className="font-bold">Net pay: {entry.netAmountFormatted}</p>
            {entry.canViewPayslip && <TenantLink className="inline-block underline" href={`/dashboard/payroll/payslips/${entry.id}`}>View / Print Payslip</TenantLink>}
            {!isPeriodFinalized && editor && periodId && <PayrollEarningsForm employees={[editor]} periodId={periodId} />}
          </div>
        </details>
      </section>;
    })}
  </div>;
}
