import Link from 'next/link';
import { getMyDashboard } from '@/features/employee-self-service/queries';
import { EssHeroBanner } from '@/components/employee-self-service/EssHeroBanner';

const time = (value: Date | null | undefined, zone: string) =>
  value
    ? new Intl.DateTimeFormat('en-PH', {
        timeZone: zone,
        hour: 'numeric',
        minute: '2-digit',
      }).format(value)
    : '—';

export default async function EmployeeDashboardPage() {
  const data = await getMyDashboard();
  const employment = data.profile?.employee.employmentRecords[0];
  const schedule = data.profile?.schedule;
  const weekday = new Date(`${data.today}T00:00:00Z`).getUTCDay() || 7;
  const todayRule = schedule?.days.find((day) => day.isoWeekday === weekday);
  const second = (value: number | null | undefined) =>
    value == null
      ? '—'
      : `${String(Math.floor(value / 3600)).padStart(2, '0')}:${String(
          Math.floor((value % 3600) / 60)
        ).padStart(2, '0')}`;

  const firstName = data.profile?.employee.firstName;
  const lastName = data.profile?.employee.lastName;
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Colleague';

  const isWorkday = Boolean(todayRule?.isWorkday);
  const scheduleText = !schedule || !todayRule
    ? 'No schedule assigned today'
    : isWorkday
    ? `You are scheduled today (${second(todayRule.expectedStartSecond)}–${second(todayRule.expectedEndSecond)})`
    : 'Rest day today';

  const pendingLeaves = data.leave.pendingRequestCount;
  const leaveText =
    pendingLeaves === 1
      ? '1 pending leave request'
      : `${pendingLeaves} pending leave requests`;

  const balancesCount = data.leave.balances.length;
  const statusSummary =
    balancesCount > 0
      ? `${balancesCount} leave ${balancesCount === 1 ? 'balance' : 'balances'} available`
      : 'All records up to date';

  return (
    <div className="space-y-6">
      {/* Redesigned ESS Dashboard Hero / Welcome Banner */}
      <EssHeroBanner
        employeeName={fullName}
        summaryItems={[scheduleText, leaveText, statusSummary]}
        floatingScheduleBadge={isWorkday ? 'Shift Scheduled' : 'Rest Day'}
        floatingStatusBadge={
          data.attendance?.attendanceStatus
            ? `Status: ${data.attendance.attendanceStatus}`
            : 'Attendance Ready'
        }
        primaryAction={{
          label: 'View Attendance',
          href: '/employee/attendance',
        }}
        secondaryAction={{
          label: 'Open Leave Requests',
          href: '/employee/leave',
        }}
      />

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl border bg-white p-6 shadow-xs">
          <h2 className="font-bold">Employment</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-500">Employee number</dt>
              <dd className="font-bold">{data.profile?.employee.employeeNumber}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Status</dt>
              <dd className="font-bold">{data.profile?.employee.employeeStatus}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Position</dt>
              <dd className="font-bold">{employment?.jobTitle ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Department</dt>
              <dd className="font-bold">{employment?.department ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Employment type</dt>
              <dd className="font-bold">{employment?.employmentType || 'Not available'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Category</dt>
              <dd className="font-bold">{employment?.employmentCategory ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Classification</dt>
              <dd className="font-bold">{employment?.employmentStatus ?? '—'}</dd>
            </div>
          </dl>
        </article>

        <article className="rounded-3xl border bg-white p-6 shadow-xs">
          <h2 className="font-bold">Today · {data.today}</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-slate-500">Schedule</dt>
              <dd className="font-bold">{schedule?.name ?? 'No schedule'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Expected</dt>
              <dd className="font-bold">
                {!schedule || !todayRule
                  ? 'Schedule not available'
                  : todayRule.isWorkday
                  ? `${second(todayRule.expectedStartSecond)}–${second(todayRule.expectedEndSecond)}`
                  : 'Rest day'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Attendance</dt>
              <dd className="font-bold">
                {data.attendance?.attendanceStatus ?? 'Attendance not yet available'}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Time In / Out</dt>
              <dd className="font-bold">
                {time(
                  data.attendance?.firstTimeIn,
                  data.attendance?.timeZoneSnapshot ?? data.profile?.organization.timeZone ?? 'UTC'
                )}{' '}
                /{' '}
                {time(
                  data.attendance?.lastTimeOut,
                  data.attendance?.timeZoneSnapshot ?? data.profile?.organization.timeZone ?? 'UTC'
                )}
              </dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="rounded-3xl border bg-white p-6 text-sm shadow-xs">
        <h2 className="font-bold">Employment dates</h2>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Start date</dt>
            <dd className="font-bold">
              {employment?.startDate.toISOString().slice(0, 10) ?? 'Not available'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Effective from</dt>
            <dd className="font-bold">
              {employment?.effectiveFrom.toISOString().slice(0, 10) ?? 'Not available'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-3xl border bg-white p-6 shadow-xs">
          <h2 className="font-bold">Attendance - {data.today.slice(0, 7)}</h2>
          {data.monthSummary.recordedDays === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No attendance records this month.</p>
          ) : (
            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="text-slate-500">Present days</dt>
                <dd className="font-bold">{data.monthSummary.presentDays}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Late occurrences</dt>
                <dd className="font-bold">{data.monthSummary.lateOccurrences}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Approved leave days</dt>
                <dd className="font-bold">{data.monthSummary.approvedLeaveDays}</dd>
              </div>
            </dl>
          )}
          <Link className="mt-4 inline-block text-sm font-bold text-teal-700 hover:underline" href="/employee/attendance">
            View attendance
          </Link>
        </article>

        <article className="rounded-3xl border bg-white p-6 shadow-xs">
          <h2 className="font-bold">Leave</h2>
          <p className="mt-4 text-sm">
            Pending requests: <strong>{data.leave.pendingRequestCount}</strong>
          </p>
          {data.leave.balances.length ? (
            <dl className="mt-3 space-y-2 text-sm">
              {data.leave.balances.map((balance) => (
                <div key={balance.cycleId}>
                  <dt className="text-slate-500">
                    {balance.leaveTypeName} - {balance.cycleName}
                  </dt>
                  <dd className="font-bold">
                    {balance.pendingCalculation
                      ? 'Confirmed during review'
                      : balance.remaining + ' days available'}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No applicable leave balance is available.</p>
          )}
          {data.leave.requests[0] ? (
            <p className="mt-3 text-sm">
              Latest request:{' '}
              <Link className="font-bold underline" href={'/employee/leave/' + data.leave.requests[0].id}>
                {data.leave.requests[0].leaveTypeNameSnapshot} - {data.leave.requests[0].status}
              </Link>
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No leave requests yet.</p>
          )}
          <Link className="mt-4 inline-block text-sm font-bold text-teal-700 hover:underline" href="/employee/leave">
            View leave
          </Link>
        </article>

        <article className="rounded-3xl border bg-white p-6 shadow-xs">
          <h2 className="font-bold">Latest finalized payroll</h2>
          {data.latestPayroll ? (
            <div className="mt-4 space-y-2 text-sm">
              <p>
                {data.latestPayroll.periodStart} - {data.latestPayroll.periodEnd}
              </p>
              <p>Pay date: {data.latestPayroll.payDate}</p>
              <p>
                Net pay:{' '}
                <strong>
                  {new Intl.NumberFormat('en-PH', {
                    style: 'currency',
                    currency: data.latestPayroll.currency,
                  }).format(Number(data.latestPayroll.netPay))}
                </strong>
              </p>
              <Link className="inline-block font-bold text-teal-700 hover:underline" href={'/employee/payroll/' + data.latestPayroll.entryId}>
                View Payslip
              </Link>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No finalized payslip is available yet.</p>
          )}
        </article>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link href="/employee/profile" className="rounded-2xl bg-slate-900 p-5 font-bold text-white transition hover:bg-slate-800">
          My Profile
        </Link>
        <Link href="/employee/attendance" className="rounded-2xl bg-slate-900 p-5 font-bold text-white transition hover:bg-slate-800">
          My Attendance
        </Link>
        <Link href="/employee/leave" className="rounded-2xl bg-slate-900 p-5 font-bold text-white transition hover:bg-slate-800">
          My Leave
        </Link>
        <Link href="/employee/payroll" className="rounded-2xl bg-slate-900 p-5 font-bold text-white transition hover:bg-slate-800">
          My Payroll
        </Link>
        <Link href="/employee/employment" className="rounded-2xl bg-slate-900 p-5 font-bold text-white transition hover:bg-slate-800">
          My Employment
        </Link>
      </section>
    </div>
  );
}
