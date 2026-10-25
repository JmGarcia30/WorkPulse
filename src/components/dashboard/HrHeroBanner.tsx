import Link from 'next/link';
import { ArrowRight, CalendarDays, ClipboardList } from 'lucide-react';
import { WorkPulseDashboardMascot } from './WorkPulseDashboardMascot';

type HrHeroBannerProps = {
  userName: string;
  newHires: number;
  attendanceRate: number | null;
  pendingActionsCount: number;
  totalActiveCandidates: number;
  asOfFormatted: string;
  timeZone: string;
  hasHrAccess: boolean;
  hasHiringAccess: boolean;
};

function greetingFor(timeZone: string) {
  try {
    const hour = Number(new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hourCycle: 'h23',
      timeZone,
    }).format(new Date()));
    if (hour < 12) return 'GOOD MORNING';
    if (hour < 17) return 'GOOD AFTERNOON';
    return 'GOOD EVENING';
  } catch {
    return 'WELCOME BACK';
  }
}

export function HrHeroBanner({
  userName,
  newHires,
  attendanceRate,
  pendingActionsCount,
  totalActiveCandidates,
  asOfFormatted,
  timeZone,
  hasHrAccess,
  hasHiringAccess,
}: HrHeroBannerProps) {
  const mainAction = hasHrAccess
    ? { href: '/dashboard/attendance', label: 'View Attendance' }
    : { href: '/dashboard/hiring/applicants', label: 'View Applicants' };
  const secondaryAction = hasHiringAccess
    ? { href: '/dashboard/hiring/applicants', label: 'Review Applicants' }
    : { href: '#hr-action-queue', label: 'Review HR Actions' };

  const metrics = [
    {
      label: hasHrAccess ? 'New hires this month' : 'Active candidates',
      value: hasHrAccess ? newHires.toLocaleString() : totalActiveCandidates.toLocaleString(),
    },
    ...(hasHrAccess ? [{
      label: 'Attendance rate',
      value: attendanceRate !== null ? `${attendanceRate}%` : '—',
    }] : []),
    { label: 'Pending actions', value: pendingActionsCount.toLocaleString() },
  ];

  return (
    <section aria-label="Workforce welcome" className="relative isolate overflow-hidden rounded-[1.5rem] border border-[var(--tenant-border)] bg-white">
      <div className="relative grid items-stretch sm:grid-cols-[minmax(0,1fr)_12rem] lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="relative z-10 min-w-0 px-6 pb-6 pt-7 sm:py-8 sm:pl-8 lg:py-9 lg:pl-10">
          <p className="text-[11px] font-extrabold tracking-[0.12em] text-[var(--tenant-accent)]">
            {greetingFor(timeZone)}
          </p>
          <h1 className="mt-2 max-w-2xl text-[clamp(1.6rem,2.3vw,2.25rem)] font-bold leading-[1.15] tracking-tight text-[var(--wp-text)]">
            Here&apos;s how your workforce stands today, {userName}.
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--wp-text-muted)]">
            Your team, hiring activity, and pending tasks at a glance · {asOfFormatted}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <Link href={mainAction.href} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--tenant-primary)] px-4 py-2 text-sm font-semibold text-[var(--tenant-primary-foreground)] transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tenant-primary)]">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {mainAction.label}
            </Link>
            <Link href={secondaryAction.href} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--wp-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--wp-text)] transition hover:bg-[var(--wp-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tenant-primary)]">
              <ClipboardList className="h-4 w-4" aria-hidden="true" />
              {secondaryAction.label}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>

          <dl className="mt-6 flex flex-wrap gap-x-7 gap-y-3 border-t border-[var(--wp-border)] pt-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="min-w-[6.5rem]">
                <dd className="text-lg font-bold tabular-nums text-[var(--wp-text)]">{metric.value}</dd>
                <dt className="text-[11px] font-medium text-[var(--wp-text-muted)]">{metric.label}</dt>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative hidden min-h-64 items-end justify-center overflow-hidden bg-[color-mix(in_srgb,var(--tenant-accent)_5%,white)] sm:flex">
          <div className="absolute left-0 top-0 h-full w-12 bg-gradient-to-r from-white to-transparent" aria-hidden="true" />
          <WorkPulseDashboardMascot />
        </div>
      </div>
    </section>
  );
}
