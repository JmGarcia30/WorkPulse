import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

interface AttendanceTrackerDonutProps {
  present: number;
  absent: number;
  incomplete: number;
  approvedLeave: number;
  totalRecorded: number;
  rate: number | null;
}

export function AttendanceTrackerDonut({
  present,
  absent,
  incomplete,
  approvedLeave,
  totalRecorded,
  rate,
}: AttendanceTrackerDonutProps) {
  // SVG Donut calculation
  const size = 180;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2; // ~83
  const circumference = 2 * Math.PI * radius;

  // Segment values and percentages
  const slices = [
    { label: 'Present', count: present, color: 'var(--tenant-primary, #0f766e)' },
    { label: 'Approved Leave', count: approvedLeave, color: '#3b82f6' },
    { label: 'Incomplete', count: incomplete, color: '#f59e0b' },
    { label: 'Absent', count: absent, color: '#ef4444' },
  ];

  let cumulativePercent = 0;
  const segments = slices.map((slice) => {
    const percent = totalRecorded > 0 ? slice.count / totalRecorded : 0;
    const strokeDasharray = `${percent * circumference} ${circumference}`;
    const strokeDashoffset = -cumulativePercent * circumference;
    cumulativePercent += percent;
    return {
      ...slice,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <div className="flex flex-col justify-between rounded-2xl bg-white p-5 shadow-[0_3px_16px_rgba(30,35,40,0.06)] h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900 tracking-tight">
          Today&apos;s Attendance
        </h2>
        <Link
          href="/dashboard/attendance"
          className="text-xs font-semibold text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 transition-colors"
          title="Open attendance module"
        >
          View Details
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Circular Chart Area */}
      <div className="my-5 flex flex-col items-center justify-center">
        <div className="relative flex items-center justify-center">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="-rotate-90 transform"
          >
            {/* Background track circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#f1f5f9"
              strokeWidth={strokeWidth}
              fill="transparent"
            />

            {/* Segments */}
            {totalRecorded > 0 &&
              segments.map((seg) => {
                if (seg.count === 0) return null;
                return (
                  <circle
                    key={seg.label}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={seg.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={seg.strokeDasharray}
                    strokeDashoffset={seg.strokeDashoffset}
                    fill="transparent"
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                );
              })}
          </svg>

          {/* Center Statistic */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              {present.toLocaleString()}
            </span>
            <span className="text-xs font-medium text-slate-400">
              Present
            </span>
            <span className="mt-0.5 text-[11px] font-semibold text-slate-500 tabular-nums">
              {totalRecorded > 0 ? `${rate}% of recorded` : '0 recorded'}
            </span>
          </div>
        </div>
      </div>

      {/* Legend Grid */}
      <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
        {slices.map((slice) => (
          <div key={slice.label} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: slice.color }}
              />
              <span className="text-slate-500 font-medium truncate">
                {slice.label}
              </span>
            </div>
            <span className="font-semibold text-slate-800 tabular-nums pl-1">
              {slice.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
