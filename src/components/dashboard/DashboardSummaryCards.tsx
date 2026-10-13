import Link from 'next/link';
import { Users, UserCheck, Briefcase, CalendarCheck } from 'lucide-react';

interface DashboardSummaryCardsProps {
  totalEmployees: number;
  presentToday: number;
  openPositions: number;
  hasHrAccess: boolean;
  totalCandidates?: number;
  scheduledInterviews?: number;
}

export function DashboardSummaryCards({
  totalEmployees,
  presentToday,
  openPositions,
  hasHrAccess,
  totalCandidates = 0,
  scheduledInterviews = 0,
}: DashboardSummaryCardsProps) {
  const cards = hasHrAccess
    ? [
        {
          title: 'Total Employees',
          supportingLabel: 'Active Staff',
          value: totalEmployees,
          icon: Users,
          href: '/dashboard/employees',
          badgeColor: 'text-[var(--tenant-primary)] bg-[var(--tenant-tint)]',
        },
        {
          title: 'Present Today',
          supportingLabel: 'Employees Checked In',
          value: presentToday,
          icon: UserCheck,
          href: '/dashboard/attendance',
          badgeColor: 'text-emerald-700 bg-emerald-50',
        },
        {
          title: 'Open Positions',
          supportingLabel: 'Active Job Openings',
          value: openPositions,
          icon: Briefcase,
          href: '/dashboard/hiring/jobs',
          badgeColor: 'text-indigo-700 bg-indigo-50',
        },
      ]
    : [
        {
          title: 'Open Positions',
          supportingLabel: 'Active Job Openings',
          value: openPositions,
          icon: Briefcase,
          href: '/dashboard/hiring/jobs',
          badgeColor: 'text-indigo-700 bg-indigo-50',
        },
        {
          title: 'Active Candidates',
          supportingLabel: 'In Pipeline Evaluation',
          value: totalCandidates,
          icon: Users,
          href: '/dashboard/hiring/applicants',
          badgeColor: 'text-purple-700 bg-purple-50',
        },
        {
          title: 'Scheduled Interviews',
          supportingLabel: 'Upcoming Candidate Meetings',
          value: scheduledInterviews,
          icon: CalendarCheck,
          href: '/dashboard/hiring/interviews',
          badgeColor: 'text-emerald-700 bg-emerald-50',
        },
      ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Link
            key={card.title}
            href={card.href}
            className="group relative flex flex-col justify-between rounded-2xl bg-white p-5 border border-slate-200/80 transition-all hover:border-slate-300 hover:bg-slate-50/30"
          >
            {/* Top row: Icon Badge and Title */}
            <div className="flex items-center gap-3">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl text-sm transition-transform group-hover:scale-105 ${card.badgeColor}`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-slate-800">
                {card.title}
              </span>
            </div>

            {/* Bottom area: Supporting label and Large numerical statistic */}
            <div className="mt-5 space-y-1">
              <div className="text-xs font-medium text-slate-400">
                {card.supportingLabel}
              </div>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                {card.value.toLocaleString()}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
