import Link from 'next/link';
import {
  Banknote,
  BriefcaseBusiness,
  CalendarCheck2,
  CalendarDays,
  ChevronRight,
  Clock3,
  FileText,
  LogOut,
  UserCheck,
  UserRound,
} from 'lucide-react';
import { getMyDashboard } from '@/features/employee-self-service/queries';
import { EssHeroBanner } from '@/components/employee-self-service/EssHeroBanner';

const formatTime = (value: Date | null | undefined, zone: string) =>
  value
    ? new Intl.DateTimeFormat('en-PH', {
        timeZone: zone,
        hour: 'numeric',
        minute: '2-digit',
      }).format(value)
    : '—';

const formatSeconds = (value: number | null | undefined) =>
  value == null
    ? '—'
    : `${String(Math.floor(value / 3600)).padStart(2, '0')}:${String(
        Math.floor((value % 3600) / 60)
      ).padStart(2, '0')}`;

const formatDate = (value: Date | string | null | undefined) => {
  if (!value) return 'Not available';
  const str = typeof value === 'string' ? value : value.toISOString().slice(0, 10);
  try {
    return new Intl.DateTimeFormat('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${str.slice(0, 10)}T00:00:00Z`));
  } catch {
    return str;
  }
};

export default async function EmployeeDashboardPage() {
  const data = await getMyDashboard();
  const employment = data.profile?.employee.employmentRecords[0];
  const schedule = data.profile?.schedule;
  const weekday = new Date(`${data.today}T00:00:00Z`).getUTCDay() || 7;
  const todayRule = schedule?.days.find((day) => day.isoWeekday === weekday);

  const firstName = data.profile?.employee.firstName;
  const lastName = data.profile?.employee.lastName;
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || 'Colleague';

  const isWorkday = Boolean(todayRule?.isWorkday);
  const scheduleText = !schedule || !todayRule
    ? 'No schedule assigned today'
    : isWorkday
    ? `Scheduled today (${formatSeconds(todayRule.expectedStartSecond)}–${formatSeconds(todayRule.expectedEndSecond)})`
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

  const timeZone =
    data.attendance?.timeZoneSnapshot ?? data.profile?.organization.timeZone ?? 'UTC';

  const hasAttendanceStatus = Boolean(data.attendance?.attendanceStatus);

  return (
    <div className="space-y-6">
      {/* 1. Mascot Welcome & Daily Summary Banner */}
      <EssHeroBanner
        employeeName={fullName}
        summaryItems={[scheduleText, leaveText, statusSummary]}
        floatingScheduleBadge={isWorkday ? 'Shift Scheduled' : 'Rest Day'}
        floatingStatusBadge={
          hasAttendanceStatus
            ? `Status: ${data.attendance?.attendanceStatus}`
            : 'Attendance Ready'
        }
        primaryAction={{
          label: 'View Attendance',
          href: '/employee/attendance',
        }}
        secondaryAction={{
          label: 'File Leave Request',
          href: '/employee/leave/new',
        }}
      />

      {/* 2. Top Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Shift */}
        <Link
          href="/employee/attendance"
          className="group relative flex flex-col justify-between rounded-2xl bg-white p-5 border border-slate-200/80 transition-all hover:border-slate-300 hover:bg-slate-50/30"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl text-sm transition-transform group-hover:scale-105 text-[var(--tenant-primary)] bg-[var(--tenant-tint)]">
              <Clock3 className="h-4 w-4" />
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                isWorkday ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {isWorkday ? 'Workday' : 'Rest Day'}
            </span>
          </div>
          <div className="mt-4 space-y-1">
            <div className="text-xs font-medium text-slate-400">Today&apos;s Schedule</div>
            <div className="text-base sm:text-lg font-bold tracking-tight text-slate-900 truncate">
              {schedule?.name ?? 'Standard Schedule'}
            </div>
            <p className="text-xs text-slate-500 truncate">
              {isWorkday && todayRule
                ? `${formatSeconds(todayRule.expectedStartSecond)} – ${formatSeconds(todayRule.expectedEndSecond)}`
                : 'No shift required'}
            </p>
          </div>
        </Link>

        {/* Card 2: Attendance Status */}
        <Link
          href="/employee/attendance"
          className="group relative flex flex-col justify-between rounded-2xl bg-white p-5 border border-slate-200/80 transition-all hover:border-slate-300 hover:bg-slate-50/30"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl text-sm transition-transform group-hover:scale-105 text-emerald-700 bg-emerald-50">
              <UserCheck className="h-4 w-4" />
            </span>
            <span className="text-[11px] font-bold text-slate-500">
              {data.monthSummary.recordedDays} days logged
            </span>
          </div>
          <div className="mt-4 space-y-1">
            <div className="text-xs font-medium text-slate-400">Monthly Attendance</div>
            <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              {data.monthSummary.presentDays} <span className="text-sm font-semibold text-slate-500">present</span>
            </div>
            <p className="text-xs text-slate-500">
              {data.monthSummary.lateOccurrences} late • {data.monthSummary.approvedLeaveDays} on leave
            </p>
          </div>
        </Link>

        {/* Card 3: Leave Balances & Requests */}
        <Link
          href="/employee/leave"
          className="group relative flex flex-col justify-between rounded-2xl bg-white p-5 border border-slate-200/80 transition-all hover:border-slate-300 hover:bg-slate-50/30"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl text-sm transition-transform group-hover:scale-105 text-indigo-700 bg-indigo-50">
              <CalendarDays className="h-4 w-4" />
            </span>
            {pendingLeaves > 0 ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                {pendingLeaves} Pending
              </span>
            ) : (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                Up to date
              </span>
            )}
          </div>
          <div className="mt-4 space-y-1">
            <div className="text-xs font-medium text-slate-400">Leave Entitlements</div>
            <div className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              {balancesCount} <span className="text-sm font-semibold text-slate-500">types available</span>
            </div>
            <p className="text-xs text-slate-500">
              {data.leave.requests[0]
                ? `Last: ${data.leave.requests[0].status}`
                : 'No recent requests'}
            </p>
          </div>
        </Link>

        {/* Card 4: Latest Payslip */}
        <Link
          href="/employee/payroll"
          className="group relative flex flex-col justify-between rounded-2xl bg-white p-5 border border-slate-200/80 transition-all hover:border-slate-300 hover:bg-slate-50/30"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl text-sm transition-transform group-hover:scale-105 text-emerald-700 bg-emerald-50">
              <Banknote className="h-4 w-4" />
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
              {data.latestPayroll ? 'Finalized' : 'Pending'}
            </span>
          </div>
          <div className="mt-4 space-y-1">
            <div className="text-xs font-medium text-slate-400">Latest Net Pay</div>
            <div className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 truncate">
              {data.latestPayroll
                ? new Intl.NumberFormat('en-PH', {
                    style: 'currency',
                    currency: data.latestPayroll.currency,
                  }).format(Number(data.latestPayroll.netPay))
                : 'Awaiting payroll'}
            </div>
            <p className="text-xs text-slate-500 truncate">
              {data.latestPayroll
                ? `Paid: ${data.latestPayroll.payDate}`
                : 'No finalized payslip yet'}
            </p>
          </div>
        </Link>
      </div>

      {/* 3. Main Dashboard Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Column (8 cols): Today's Activity & Leave Balances */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          {/* Today's Attendance Activity Card */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--tenant-tint)] text-[var(--tenant-primary)]">
                  <Clock3 className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">Today&apos;s Timekeeping</h2>
                  <p className="text-xs text-slate-500">Date: {data.today} ({timeZone})</p>
                </div>
              </div>
              <Link
                href="/employee/attendance"
                className="text-xs font-bold text-[var(--tenant-accent)] hover:underline inline-flex items-center gap-1"
              >
                <span>View Attendance</span>
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                <dt className="text-xs font-medium text-slate-500">First Time In</dt>
                <dd className="mt-1 text-base font-bold text-slate-900">
                  {formatTime(data.attendance?.firstTimeIn, timeZone)}
                </dd>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                <dt className="text-xs font-medium text-slate-500">Last Time Out</dt>
                <dd className="mt-1 text-base font-bold text-slate-900">
                  {formatTime(data.attendance?.lastTimeOut, timeZone)}
                </dd>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                <dt className="text-xs font-medium text-slate-500">Today&apos;s Status</dt>
                <dd className="mt-1 text-sm font-bold text-slate-900">
                  {data.attendance?.attendanceStatus ?? 'Not recorded yet'}
                </dd>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                <dt className="text-xs font-medium text-slate-500">Expected Hours</dt>
                <dd className="mt-1 text-sm font-bold text-slate-900">
                  {todayRule?.isWorkday
                    ? `${formatSeconds(todayRule.expectedStartSecond)} – ${formatSeconds(todayRule.expectedEndSecond)}`
                    : 'Rest Day'}
                </dd>
              </div>
            </div>
          </section>

          {/* Leave Entitlements and Balances Card */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
                  <CalendarDays className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-slate-900">Leave Entitlements</h2>
                  <p className="text-xs text-slate-500">{balancesCount} active leave policy balances</p>
                </div>
              </div>
              <Link
                href="/employee/leave"
                className="text-xs font-bold text-[var(--tenant-accent)] hover:underline inline-flex items-center gap-1"
              >
                <span>Leave Portal</span>
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {data.leave.balances.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {data.leave.balances.map((balance) => (
                  <div
                    key={balance.cycleId}
                    className="flex items-center justify-between rounded-xl border border-slate-100 p-3.5 hover:bg-slate-50/40 transition"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {balance.leaveTypeName}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{balance.cycleName}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[var(--tenant-tint)] px-2.5 py-1 text-xs font-bold text-[var(--tenant-primary)]">
                      {balance.pendingCalculation
                        ? 'Under review'
                        : `${balance.remaining} days`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-xs text-slate-500">No applicable leave balances currently available.</p>
            )}

            {data.leave.requests[0] && (
              <div className="mt-4 rounded-xl border border-slate-200/70 bg-slate-50/60 p-3.5 text-xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-slate-600">Latest Request:</span>
                  <strong className="text-slate-800">
                    {data.leave.requests[0].leaveTypeNameSnapshot} ({data.leave.requests[0].status})
                  </strong>
                </div>
                <Link
                  href={`/employee/leave/${data.leave.requests[0].id}`}
                  className="font-bold text-[var(--tenant-accent)] hover:underline"
                >
                  View Details
                </Link>
              </div>
            )}
          </section>
        </div>

        {/* Right Column (4 cols): Employment Overview & Quick Actions */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          {/* Employment Overview Widget */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xs">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <BriefcaseBusiness className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-slate-900">Employment Overview</h2>
                <p className="text-xs text-slate-500">{data.profile?.organization.name}</p>
              </div>
            </div>

            <dl className="mt-4 space-y-3 text-xs sm:text-sm">
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <dt className="text-slate-500">Employee No.</dt>
                <dd className="font-bold text-slate-900">{data.profile?.employee.employeeNumber}</dd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <dt className="text-slate-500">Position</dt>
                <dd className="font-bold text-slate-900 truncate max-w-44 text-right">
                  {employment?.jobTitle ?? '—'}
                </dd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <dt className="text-slate-500">Department</dt>
                <dd className="font-bold text-slate-900 truncate max-w-44 text-right">
                  {employment?.department ?? '—'}
                </dd>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <dt className="text-slate-500">Status</dt>
                <dd className="font-bold text-slate-900">
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 font-bold">
                    {data.profile?.employee.employeeStatus}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between items-center py-1">
                <dt className="text-slate-500">Start Date</dt>
                <dd className="font-bold text-slate-900">
                  {formatDate(employment?.startDate)}
                </dd>
              </div>
            </dl>

            <Link
              href="/employee/employment"
              className="mt-4 block w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              View Full Employment Record
            </Link>
          </section>

          {/* Quick Actions Panel */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xs">
            <h2 className="text-sm font-bold text-slate-900 mb-3">Self-Service Actions</h2>
            <div className="space-y-2">
              <Link
                href="/employee/leave/new"
                className="flex items-center justify-between rounded-xl border border-slate-200/70 p-3 text-xs font-semibold text-slate-800 hover:border-slate-300 hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-2.5">
                  <CalendarCheck2 className="h-4 w-4 text-[var(--tenant-primary)]" />
                  <span>File a Leave Request</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>

              <Link
                href="/employee/attendance"
                className="flex items-center justify-between rounded-xl border border-slate-200/70 p-3 text-xs font-semibold text-slate-800 hover:border-slate-300 hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-2.5">
                  <Clock3 className="h-4 w-4 text-[var(--tenant-accent)]" />
                  <span>View Attendance Records</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>

              <Link
                href="/employee/payroll"
                className="flex items-center justify-between rounded-xl border border-slate-200/70 p-3 text-xs font-semibold text-slate-800 hover:border-slate-300 hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-2.5">
                  <Banknote className="h-4 w-4 text-emerald-600" />
                  <span>View Finalized Payslips</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>

              <Link
                href="/employee/profile"
                className="flex items-center justify-between rounded-xl border border-slate-200/70 p-3 text-xs font-semibold text-slate-800 hover:border-slate-300 hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-2.5">
                  <UserRound className="h-4 w-4 text-indigo-600" />
                  <span>My Profile & Work Schedule</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>

              <Link
                href="/employee/resignation"
                className="flex items-center justify-between rounded-xl border border-slate-200/70 p-3 text-xs font-semibold text-slate-800 hover:border-slate-300 hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-2.5">
                  <LogOut className="h-4 w-4 text-slate-500" />
                  <span>Resignation & Exit Notices</span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
