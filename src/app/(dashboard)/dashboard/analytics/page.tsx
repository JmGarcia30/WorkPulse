import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getAnalytics } from '@/features/analytics/queries';
import { AnalyticsFilterError, type AnalyticsFilters } from '@/features/analytics/date-range';
import { requireBackOfficeContext } from '@/lib/auth/guards';
import { canViewAnalytics } from '@/lib/permissions/rbac';
import { formatStatusLabel } from '@/lib/ui/format-status';

function Summary({ items }: { items: Array<[string, string | number]> }) {
  return <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 xl:grid-cols-5">{items.map(([label, value]) => <div key={label}><dt className="text-xs text-[var(--wp-text-muted)]">{label}</dt><dd className="mt-1 text-xl font-bold tabular-nums">{value}</dd></div>)}</dl>;
}

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return <section className="wp-card space-y-5 p-5"><header><h2 className="text-lg font-bold">{title}</h2><p className="mt-1 text-xs leading-relaxed text-[var(--wp-text-muted)]">{note}</p></header>{children}</section>;
}

function Breakdown({ title, rows }: { title: string; rows: Array<{ name: string; count: number }> }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return <div><h3 className="mb-3 text-sm font-bold">{title}</h3>{total === 0 ? <p className="text-sm text-[var(--wp-text-muted)]">No matching records.</p> : <ul className="space-y-3">{rows.map(row => <li key={row.name}><div className="mb-1 flex justify-between gap-3 text-xs"><span>{row.name}</span><strong className="tabular-nums">{row.count}</strong></div><div className="h-2 overflow-hidden rounded bg-[var(--wp-surface-subtle)]" aria-hidden="true"><div className="h-full rounded bg-[var(--tenant-primary)]" style={{ width: `${100 * row.count / total}%` }} /></div></li>)}</ul>}</div>;
}

function money(amount: string, currency: string) {
  try { return new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(Number(amount)); }
  catch { return `${currency} ${amount}`; }
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<AnalyticsFilters> }) {
  const user = await requireBackOfficeContext();
  if (!canViewAnalytics(user)) redirect('/dashboard');
  const params = await searchParams;
  let data;
  let filterError: string | null = null;
  try { data = await getAnalytics(params); }
  catch (error) {
    if (!(error instanceof AnalyticsFilterError)) throw error;
    filterError = error.message;
    data = await getAnalytics();
  }
  const { range, workforce, attendance, leave, payroll, employment } = data;
  const presetLink = (preset: string) => `/dashboard/analytics?${new URLSearchParams({ preset, category: range.category })}`;
  return <div className="space-y-5">
    <header><p className="wp-eyebrow">Workforce insights</p><h1 className="wp-page-title mt-1">HR Analytics</h1><p className="mt-2 text-sm text-[var(--wp-text-muted)]">Stored WorkPulse records for {range.from} to {range.to}. Dates use {data.timeZone}.</p></header>
    {filterError && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{filterError} Showing This Month instead.</p>}
    <div className="wp-card p-4"><div className="mb-4 flex flex-wrap items-center gap-2"><Link href={presetLink('this-month')} aria-current={range.preset === 'this-month' ? 'page' : undefined} className={range.preset === 'this-month' ? 'wp-button-primary' : 'wp-button-secondary'}>This Month</Link><Link href={presetLink('last-month')} aria-current={range.preset === 'last-month' ? 'page' : undefined} className={range.preset === 'last-month' ? 'wp-button-primary' : 'wp-button-secondary'}>Last Month</Link><span className="text-xs text-[var(--wp-text-muted)]">Or apply a custom range (maximum 366 days).</span></div>
      <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Analytics filters"><input type="hidden" name="preset" value="custom" /><label className="wp-label">From<input className="wp-input mt-1" type="date" name="from" required defaultValue={range.from} /></label><label className="wp-label">To<input className="wp-input mt-1" type="date" name="to" required defaultValue={range.to} /></label><label className="wp-label">Employee type<select className="wp-input mt-1" name="category" defaultValue={range.category}><option value="ALL">All</option><option value="TEACHING">Teaching</option><option value="NON_TEACHING">Non-Teaching</option></select></label><div className="flex items-end"><button className="wp-button-primary">Apply Custom Range</button></div></form>
      <p className="mt-3 text-xs text-[var(--wp-text-muted)]">Employee type uses current employment across all sections. Workforce and employment actions show the current position; date filters apply to conversions, attendance dates, leave dates, and payroll pay dates.</p>
    </div>

    <Section title="Workforce Overview" note="Each employee is counted once. Classification uses the latest employment effective today; historical and future appointments are excluded.">
      <Summary items={[
        ['Active employees', workforce.active], ['Probationary', workforce.probationary], ['Regular', workforce.regular],
        ['Teaching', workforce.teaching], ['Non-Teaching', workforce.nonTeaching], ['Inactive', workforce.inactive],
        ['Separated', workforce.separated], ['No current employment', workforce.unclassified], ['Conversions in range', workforce.conversions],
      ]} />
      <div className="grid gap-6 border-t border-[var(--tenant-border)] pt-4 md:grid-cols-2"><Breakdown title="Active employment classification" rows={[{ name: 'Probationary', count: workforce.probationary }, { name: 'Regular', count: workforce.regular }, { name: 'No current employment', count: workforce.unclassified }]} /><Breakdown title="Active employee type" rows={[{ name: 'Teaching', count: workforce.teaching }, { name: 'Non-Teaching', count: workforce.nonTeaching }]} /></div>
    </Section>

    <Section title="Attendance Analytics" note="Counts use stored H3 outcomes only. Late occurrences overlap attendance statuses. Attendance rate = finalized present / finalized (present + absent + incomplete) workday records; approved leave, rest days, no schedule, open records and missing records are excluded.">
      <Summary items={[
        ['Present days', attendance.presentDays], ['Absent days', attendance.absentDays], ['Late occurrences', attendance.lateOccurrences],
        ['Approved leave days', attendance.approvedLeaveDays], ['Incomplete records', attendance.incompleteDays],
        ['Attendance rate', attendance.rate === null ? 'Not available' : `${attendance.rate}%`], ['Open records', attendance.openDays], ['Finalized rate records', attendance.finalizedWorkdays],
      ]} />
      <div className="grid gap-6 border-t border-[var(--tenant-border)] pt-4 lg:grid-cols-2"><Breakdown title="Stored attendance outcomes" rows={[{ name: 'Present', count: attendance.presentDays }, { name: 'Absent', count: attendance.absentDays }, { name: 'Approved leave', count: attendance.approvedLeaveDays }, { name: 'Incomplete', count: attendance.incompleteDays }, { name: 'Open', count: attendance.openDays }]} />
        <div><h3 className="mb-3 text-sm font-bold">Employees With Most Late Occurrences</h3><div className="wp-table-wrap"><table className="wp-table"><thead><tr><th>Employee</th><th>Late count</th><th>Late minutes</th></tr></thead><tbody>{attendance.lateLeaders.map(employee => <tr key={employee.employeeNumber}><td><span className="block font-semibold">{employee.employeeName}</span><span className="text-xs text-[var(--wp-text-muted)]">{employee.employeeNumber}</span></td><td>{employee.count}</td><td>{employee.lateMinutes ?? 'Not available'}</td></tr>)}{attendance.lateLeaders.length === 0 && <tr><td colSpan={3}>No late occurrences in this range.</td></tr>}</tbody></table></div><p className="mt-2 text-xs text-[var(--wp-text-muted)]">Top 5 only. Rest/no-schedule days and approved leave are excluded.</p></div>
      </div>
    </Section>

    <Section title="Leave Analytics" note="Request counts include leave dates overlapping the range. Approved units sum finalized H5 day charges inside the range, including requests filed earlier. Cancelled, rejected and pending requests do not contribute approved units.">
      <Summary items={[
        ['Total requests', leave.requests], ['Pending', leave.pending], ['Approved', leave.approved], ['Rejected', leave.rejected],
        ['Approved units / days', leave.approvedUnits], ['Withdrawn', leave.withdrawn], ['Cancelled', leave.cancelled],
      ]} /><Breakdown title="Requests by leave type" rows={leave.byType} />
    </Section>

    <Section title="Payroll Overview" note="Periods are selected by pay date. Monetary totals include only FINALIZED entries in FINALIZED periods with a finalization timestamp. Draft/review entries contribute only to entry counts. Currencies are kept separate using finalized snapshots.">
      <Summary items={[
        ['Entries in range', payroll.entries], ['Finalized entries', payroll.finalizedEntries], ['Finalized periods', payroll.finalizedPeriods],
      ]} />
      {payroll.totals.length === 0 ? <p className="text-sm text-[var(--wp-text-muted)]">No finalized payroll totals are available in this range.</p> : <div className="space-y-4">{payroll.totals.map(total => <div key={total.currency} className="border-t border-[var(--tenant-border)] pt-4"><h3 className="mb-3 text-sm font-bold">{total.currency}</h3><Summary items={[
        ['Gross payroll', money(total.gross, total.currency)], ['Deductions', money(total.deductions, total.currency)], ['Net payroll', money(total.net, total.currency)],
      ]} /></div>)}</div>}
      {payroll.unavailableCurrencyEntries > 0 && <p className="text-sm text-amber-800">{payroll.unavailableCurrencyEntries} finalized entries have no usable currency snapshot and are excluded from monetary totals.</p>}
      <div><h3 className="mb-3 text-sm font-bold">Recent payroll periods</h3><div className="wp-table-wrap"><table className="wp-table"><thead><tr><th>Period</th><th>Pay date</th><th>Status</th><th>Employees</th><th>Gross</th><th>Deductions</th><th>Net</th></tr></thead><tbody>{payroll.periods.map(period => <tr key={period.id}><td><strong className="block">{period.name}</strong><span className="text-xs">{period.from} - {period.to}</span></td><td>{period.payDate}</td><td>{formatStatusLabel(period.status)}</td><td>{period.employees}</td><td>{period.totals.length ? period.totals.map(total => <div key={total.currency}>{money(total.gross, total.currency)}</div>) : 'Not available'}</td><td>{period.totals.length ? period.totals.map(total => <div key={total.currency}>{money(total.deductions, total.currency)}</div>) : 'Not available'}</td><td>{period.totals.length ? period.totals.map(total => <div key={total.currency}>{money(total.net, total.currency)}</div>) : 'Not available'}</td></tr>)}{payroll.periods.length === 0 && <tr><td colSpan={7}>No payroll periods in this range.</td></tr>}</tbody></table></div><p className="mt-2 text-xs text-[var(--wp-text-muted)]">Latest 6 periods in range. Summary totals include every matching finalized period.</p></div>
    </Section>

    <Section title="Employment / Probation Insights" note="Current active, pending probation cases only. Upcoming actions use H2's 30-day review window plus due/overdue cases, independently of the historical date filter. HR must make all decisions.">
      <Summary items={[
        ['Active probation cases', employment.activeProbationCases], ['Teaching cases', employment.teachingCases], ['Non-Teaching cases', employment.nonTeachingCases],
        ['Teaching appointments ending soon', employment.teachingEndingSoon], ['Actions needing attention', employment.actionCount],
      ]} />
      <div><h3 className="mb-3 text-sm font-bold">Upcoming Employment Actions</h3><div className="wp-table-wrap"><table className="wp-table"><thead><tr><th>Employee</th><th>Type</th><th>Current review status</th><th>Relevant date</th><th>Action needed</th></tr></thead><tbody>{employment.actions.map(action => <tr key={action.employeeId}><td><Link className="block font-semibold underline" href={`/dashboard/employees/${action.employeeId}`}>{action.employeeName}</Link><span className="text-xs text-[var(--wp-text-muted)]">{action.employeeNumber}</span></td><td>{formatStatusLabel(action.category)}</td><td>{formatStatusLabel(action.status)}</td><td>{action.date}</td><td>{action.action}</td></tr>)}{employment.actions.length === 0 && <tr><td colSpan={5}>No probation reviews are due or approaching.</td></tr>}</tbody></table></div><p className="mt-2 text-xs text-[var(--wp-text-muted)]">Showing up to 20 actions, earliest date first. Teaching appointment dates use the stored probation end date.</p></div>
    </Section>
  </div>;
}
