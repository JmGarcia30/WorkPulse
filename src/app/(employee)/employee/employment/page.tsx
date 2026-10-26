import Link from 'next/link';
import {
  Banknote,
  BriefcaseBusiness,
  Building,
  Calendar,
  Clock,
  FileCheck,
  ShieldAlert,
  UserCheck,
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
    : 'Not available';

export default async function MyEmploymentPage() {
  const profile = await getMyProfile();
  if (!profile) {
    return (
      <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center text-sm text-slate-500">
        Employment information is unavailable.
      </div>
    );
  }

  const employment = profile.employee.employmentRecords[0];

  const fields = [
    { label: 'Employee Number', value: profile.employee.employeeNumber, icon: UserCheck },
    { label: 'Employee Status', value: profile.employee.employeeStatus, icon: FileCheck },
    { label: 'Job Title / Position', value: employment?.jobTitle ?? '—', icon: BriefcaseBusiness },
    { label: 'Department', value: employment?.department ?? '—', icon: Building },
    { label: 'Employment Type', value: employment?.employmentType ?? '—', icon: Clock },
    { label: 'Category', value: employment?.employmentCategory ?? '—', icon: BriefcaseBusiness },
    { label: 'Classification', value: employment?.employmentStatus ?? '—', icon: FileCheck },
    { label: 'Hire Date', value: formatDate(employment?.hireDate), icon: Calendar },
    { label: 'Start Date', value: formatDate(employment?.startDate), icon: Calendar },
    { label: 'Effective From', value: formatDate(employment?.effectiveFrom), icon: Calendar },
    { label: 'Pay Frequency', value: employment?.payFrequency ?? '—', icon: Banknote },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-1">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--tenant-accent)]">
          Employee Self-Service • Employment Lifecycle
        </p>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight sm:text-3xl">
          My Employment
        </h1>
        <p className="text-sm text-slate-500">
          Official position assignment, classification, and lifecycle milestones maintained by HR.
        </p>
      </header>

      {/* Main Employment Record Card */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 sm:p-7 shadow-2xs space-y-6">
        <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--tenant-tint)] text-[var(--tenant-primary)]">
            <BriefcaseBusiness className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">Current Assignment</h2>
            <p className="text-xs text-slate-500">{profile.organization.name}</p>
          </div>
        </div>

        {!employment ? (
          <p className="text-xs text-slate-500">No active employment record found.</p>
        ) : (
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 text-xs sm:text-sm">
            {fields.map(({ label, value, icon: Icon }) => (
              <div key={label} className="space-y-1">
                <dt className="text-slate-400 flex items-center gap-1.5 font-medium">
                  <Icon className="h-3.5 w-3.5 text-slate-400" />
                  <span>{label}</span>
                </dt>
                <dd className="font-bold text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {/* Probation Review Card (If Applicable) */}
      {employment?.probation && (
        <section className="rounded-2xl border border-amber-200/80 bg-amber-50/20 p-6 sm:p-7 shadow-2xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-amber-200/60 pb-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
              <ShieldAlert className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-amber-950">Probationary Period</h2>
              <p className="text-xs text-amber-800">Active performance review period</p>
            </div>
          </div>

          <dl className="grid gap-4 sm:grid-cols-3 text-xs sm:text-sm">
            <div>
              <dt className="text-amber-800/80 font-medium">Status</dt>
              <dd className="font-bold text-amber-950 mt-1">
                <span className="rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                  {employment.probation.probationStatus}
                </span>
              </dd>
            </div>

            <div>
              <dt className="text-amber-800/80 font-medium">Started At</dt>
              <dd className="font-bold text-amber-950 mt-1">
                {formatDate(employment.probation.startedAt)}
              </dd>
            </div>

            <div>
              <dt className="text-amber-800/80 font-medium">Expected End Date</dt>
              <dd className="font-bold text-amber-950 mt-1">
                {formatDate(employment.probation.expectedEndAt)}
              </dd>
            </div>
          </dl>
        </section>
      )}

      {/* Quick Action Navigation */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Banknote className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Compensation & Payslips</h3>
            <p className="text-xs text-slate-500">
              Access your monthly payment history, gross earnings, and deduction breakdowns.
            </p>
          </div>
        </div>

        <Link
          href="/employee/payroll"
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-[var(--tenant-primary)] px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-2xs hover:brightness-95 transition"
        >
          View Finalized Payslips
        </Link>
      </section>
    </div>
  );
}
