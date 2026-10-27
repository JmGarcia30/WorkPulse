interface DashboardHeaderProps {
  userName: string;
  newHires: number;
  attendanceRate: number | null;
  pendingActionsCount: number;
  asOfFormatted: string;
}

export function DashboardHeader({
  userName,
  newHires,
  attendanceRate,
  pendingActionsCount,
  asOfFormatted,
}: DashboardHeaderProps) {
  return (
    <header className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
      {/* Left: Welcome heading and supporting description */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl lg:text-[2rem] font-bold tracking-tight text-[#282934]">
          Welcome Back, {userName}
        </h1>
        <p className="text-sm text-[#62636B] font-normal">
          Here&apos;s what&apos;s happening across your workforce • <span className="text-[#777882]">{asOfFormatted}</span>
        </p>
      </div>

      {/* Right: Three compact numerical statistics */}
      <div className="flex flex-wrap items-center gap-6 sm:gap-10">
        {/* Metric 1: New Hires */}
        <div className="space-y-0.5">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#282934] tabular-nums">
            {newHires.toLocaleString()}
          </div>
          <div className="text-[11px] font-semibold text-[#777882] uppercase tracking-wider">
            New Hires
          </div>
        </div>

        {/* Metric 2: Attendance Rate */}
        <div className="space-y-0.5">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#282934] tabular-nums">
            {attendanceRate !== null ? `${attendanceRate}%` : '—'}
          </div>
          <div className="text-[11px] font-semibold text-[#777882] uppercase tracking-wider">
            Attendance Rate
          </div>
        </div>

        {/* Metric 3: Pending HR Actions */}
        <div className="space-y-0.5">
          <div className="text-2xl sm:text-3xl font-bold tracking-tight text-[#282934] tabular-nums">
            {pendingActionsCount.toLocaleString()}
          </div>
          <div className="text-[11px] font-semibold text-[#777882] uppercase tracking-wider">
            Pending Actions
          </div>
        </div>
      </div>
    </header>
  );
}
