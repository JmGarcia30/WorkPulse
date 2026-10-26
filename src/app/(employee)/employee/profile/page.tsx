import {
  Briefcase,
  Building,
  Clock,
  Mail,
  Phone,
  ShieldCheck,
} from 'lucide-react';
import { getMyProfile } from '@/features/employee-self-service/queries';

const formatDate = (value: Date | null | undefined) =>
  value
    ? new Intl.DateTimeFormat('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(value)
    : '—';

const formatClock = (seconds: number | null) =>
  seconds == null
    ? '—'
    : `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(
        Math.floor((seconds % 3600) / 60)
      ).padStart(2, '0')}`;

const weekdays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export default async function MyProfilePage() {
  const profile = await getMyProfile();
  if (!profile) return null;

  const employment = profile.employee.employmentRecords[0];
  const initials = [profile.employee.firstName?.[0], profile.employee.lastName?.[0]]
    .filter(Boolean)
    .join('')
    .toUpperCase() || 'E';

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-1">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--tenant-accent)]">
          Employee Self-Service • Identity & Profile
        </p>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight sm:text-3xl">
          My Profile
        </h1>
        <p className="text-sm text-slate-500">
          Official employee identity, employment assignment, and schedule details maintained by HR.
        </p>
      </header>

      {/* Profile Overview Card */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 border-b border-slate-100 pb-6">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--tenant-primary)] text-xl font-black text-white shadow-xs">
            {initials}
          </div>
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                {profile.employee.firstName} {profile.employee.lastName}
              </h2>
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                {profile.employee.employeeStatus}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 flex flex-wrap items-center gap-2">
              <span>{employment?.jobTitle ?? 'Staff'}</span>
              <span>•</span>
              <span>{employment?.department ?? 'General Department'}</span>
              <span>•</span>
              <span className="font-semibold text-slate-700">ID: {profile.employee.employeeNumber}</span>
            </p>
          </div>
        </div>

        {/* Personal & Account Grid */}
        <div className="pt-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
            Contact & Account Information
          </h3>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs sm:text-sm">
            <div className="space-y-1">
              <dt className="text-slate-400 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                <span>Contact Email</span>
              </dt>
              <dd className="font-semibold text-slate-800 break-all">{profile.employee.email}</dd>
            </div>

            <div className="space-y-1">
              <dt className="text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Login Account Email</span>
              </dt>
              <dd className="font-semibold text-slate-800 break-all">{profile.loginEmail}</dd>
            </div>

            <div className="space-y-1">
              <dt className="text-slate-400 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" />
                <span>Phone Number</span>
              </dt>
              <dd className="font-semibold text-slate-800">{profile.employee.phone || '—'}</dd>
            </div>

            <div className="space-y-1">
              <dt className="text-slate-400 flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5" />
                <span>Organization</span>
              </dt>
              <dd className="font-semibold text-slate-800">{profile.organization.name}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Employment Assignment Details Card */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-2xs space-y-5">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
            <Briefcase className="h-4 w-4" />
          </span>
          <h2 className="text-sm sm:text-base font-bold text-slate-900">Employment Details</h2>
        </div>

        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs sm:text-sm">
          <div>
            <dt className="text-slate-400">Position / Job Title</dt>
            <dd className="font-bold text-slate-900 mt-1">{employment?.jobTitle ?? '—'}</dd>
          </div>

          <div>
            <dt className="text-slate-400">Department</dt>
            <dd className="font-bold text-slate-900 mt-1">{employment?.department ?? '—'}</dd>
          </div>

          <div>
            <dt className="text-slate-400">Employment Category</dt>
            <dd className="font-bold text-slate-900 mt-1">{employment?.employmentCategory ?? '—'}</dd>
          </div>

          <div>
            <dt className="text-slate-400">Classification</dt>
            <dd className="font-bold text-slate-900 mt-1">{employment?.employmentStatus ?? '—'}</dd>
          </div>

          <div>
            <dt className="text-slate-400">Employment Type</dt>
            <dd className="font-bold text-slate-900 mt-1">{employment?.employmentType ?? '—'}</dd>
          </div>

          <div>
            <dt className="text-slate-400">Hire / Start Date</dt>
            <dd className="font-bold text-slate-900 mt-1">
              {formatDate(employment?.hireDate)} / {formatDate(employment?.startDate)}
            </dd>
          </div>

          <div>
            <dt className="text-slate-400">Effective Period</dt>
            <dd className="font-bold text-slate-900 mt-1">
              {formatDate(employment?.effectiveFrom)} – {formatDate(employment?.effectiveTo)}
            </dd>
          </div>

          {employment?.probation && (
            <div>
              <dt className="text-slate-400">Probation Expected End</dt>
              <dd className="font-bold text-slate-900 mt-1">
                {formatDate(employment.probation.expectedEndAt)}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Work Schedule Card */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--tenant-tint)] text-[var(--tenant-primary)]">
              <Clock className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">Current Work Schedule</h2>
              <p className="text-xs text-slate-500">
                {profile.schedule?.name ?? 'No active schedule policy assigned'}
              </p>
            </div>
          </div>
          {profile.schedule && (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Weekly Shift Policy
            </span>
          )}
        </div>

        {profile.schedule ? (
          <div className="grid gap-2 sm:gap-3">
            {profile.schedule.days.map((day) => (
              <div
                key={day.isoWeekday}
                className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-slate-100 p-3 sm:px-4 text-xs sm:text-sm hover:bg-slate-50/50 transition gap-2"
              >
                <div className="flex items-center gap-3 min-w-32">
                  <strong className="text-slate-900 w-24">{weekdays[day.isoWeekday - 1]}</strong>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      day.isWorkday
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {day.isWorkday ? 'Workday' : 'Rest Day'}
                  </span>
                </div>

                <div className="text-slate-700 font-semibold">
                  {day.isWorkday
                    ? `${formatClock(day.expectedStartSecond)} – ${formatClock(day.expectedEndSecond)}`
                    : '—'}
                </div>

                <div className="text-xs text-slate-400">
                  {day.breaks.map((item) => `${formatClock(item.startSecond)}–${formatClock(item.endSecond)} (${item.isPaid ? 'paid' : 'unpaid'})`).join(', ') || 'No scheduled breaks'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No shift hours are scheduled.</p>
        )}
      </section>
    </div>
  );
}
