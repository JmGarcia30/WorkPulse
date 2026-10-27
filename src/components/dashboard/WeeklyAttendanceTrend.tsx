'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { DayAttendanceTrend } from '@/features/dashboard/read-model';

interface WeeklyAttendanceTrendProps {
  weekRangeLabel: string;
  days: DayAttendanceTrend[];
  totalPresentThisWeek: number;
  avgDailyPresent: number;
}

export function WeeklyAttendanceTrend({
  weekRangeLabel,
  days,
  totalPresentThisWeek,
  avgDailyPresent,
}: WeeklyAttendanceTrendProps) {
  // Find default active day: today or last day with records, or middle day
  const todayIndex = days.findIndex((d) => d.isToday);
  const [selectedIndex, setSelectedIndex] = useState<number>(
    todayIndex !== -1 ? todayIndex : 3
  );

  const activeDay = days[selectedIndex] ?? days[0];

  // SVG Chart Dimensions
  const width = 540;
  const height = 180;
  const paddingX = 40;
  const paddingTop = 28;
  const paddingBottom = 28;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingTop - paddingBottom;

  // Compute maximum value for scaling
  const maxPresent = Math.max(...days.map((d) => d.presentCount), 5);
  const maxLate = Math.max(...days.map((d) => d.lateCount), 1);
  const yMax = Math.max(maxPresent, maxLate * 1.5, 10);

  // Compute X and Y coordinates for each day
  const pointsPresent = days.map((day, idx) => {
    const x = paddingX + (idx / (days.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (day.presentCount / yMax) * chartHeight;
    return { x, y, day };
  });

  const pointsLate = days.map((day, idx) => {
    const x = paddingX + (idx / (days.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (day.lateCount / yMax) * chartHeight;
    return { x, y, day };
  });

  // Helper to generate smooth SVG cubic bezier path
  function createSmoothPath(points: { x: number; y: number }[]) {
    if (points.length === 0) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      d += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return d;
  }

  const presentPath = createSmoothPath(pointsPresent);
  const latePath = createSmoothPath(pointsLate);

  const selectedPoint = pointsPresent[selectedIndex];

  return (
    <div className="flex flex-col justify-between rounded-2xl bg-white p-5 shadow-[0_3px_16px_rgba(30,35,40,0.06)] h-full">
      {/* Header Row */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#282934] tracking-tight">
              Weekly Attendance Trend
            </h2>
            <span className="text-xs font-medium text-[#777882]">
              ({weekRangeLabel})
            </span>
          </div>
          <div className="flex items-baseline gap-2 pt-1">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[#282934] tabular-nums">
              {totalPresentThisWeek.toLocaleString()}
            </span>
            <span className="text-xs font-medium text-[#777882]">
              Total Present This Week (Avg {avgDailyPresent}/day)
            </span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-3">
          {/* Series Legend */}
          <div className="hidden sm:flex items-center gap-4 text-xs font-medium text-[#62636B]">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--tenant-primary,#0f766e)]" />
              <span>Present</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span>Late</span>
            </div>
          </div>

          <Link
            href="/dashboard/attendance"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-[#C7A759] hover:border-[#C7A759] transition-colors"
            title="Open attendance trends"
          >
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="relative my-2 w-full select-none">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible"
        >
          <defs>
            {/* Soft vertical gradient for the active selected day column highlight */}
            <linearGradient id="activeColumnGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--tenant-primary,#0f766e)" stopOpacity="0.12" />
              <stop offset="100%" stopColor="var(--tenant-primary,#0f766e)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Vertical dashed gridlines and active day highlight */}
          {days.map((day, idx) => {
            const x = paddingX + (idx / (days.length - 1)) * chartWidth;
            const isSelected = idx === selectedIndex;

            return (
              <g key={day.dateStr}>
                {/* Active Column pill highlight background like the reference image */}
                {isSelected && (
                  <rect
                    x={x - 18}
                    y={paddingTop - 12}
                    width={36}
                    height={chartHeight + 24}
                    rx={18}
                    fill="url(#activeColumnGradient)"
                  />
                )}

                {/* Vertical dashed line */}
                <line
                  x1={x}
                  y1={paddingTop - 6}
                  x2={x}
                  y2={paddingTop + chartHeight + 6}
                  stroke={isSelected ? 'var(--tenant-primary,#0f766e)' : '#e2e8f0'}
                  strokeWidth={isSelected ? 1.5 : 1}
                  strokeDasharray="3 3"
                />
              </g>
            );
          })}

          {/* Late Occurrences Path (amber line) */}
          <path
            d={latePath}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={2}
            strokeLinecap="round"
            className="transition-all duration-300"
          />

          {/* Present Employees Path (tenant primary or teal line) */}
          <path
            d={presentPath}
            fill="none"
            stroke="var(--tenant-primary, #0f766e)"
            strokeWidth={2.5}
            strokeLinecap="round"
            className="transition-all duration-300"
          />

          {/* Small point markers on the curves */}
          {pointsPresent.map((pt, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <circle
                key={`pres-${idx}`}
                cx={pt.x}
                cy={pt.y}
                r={isSelected ? 4.5 : 3}
                fill={isSelected ? '#ffffff' : 'var(--tenant-primary, #0f766e)'}
                stroke="var(--tenant-primary, #0f766e)"
                strokeWidth={isSelected ? 2.5 : 1.5}
              />
            );
          })}

          {/* Tooltip Pill Floating above selected point */}
          {selectedPoint && (
            <g transform={`translate(${selectedPoint.x}, ${Math.max(selectedPoint.y - 32, 8)})`}>
              {/* Tooltip bubble background */}
              <rect
                x="-45"
                y="-10"
                width="90"
                height="22"
                rx="11"
                fill="#282934"
                className="shadow-sm"
              />
              <text
                x="0"
                y="5"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="10"
                fontWeight="600"
              >
                {activeDay.presentCount} checked in
              </text>
            </g>
          )}
        </svg>

        {/* Day Selector Pills at Bottom (matching the reference M, T, W, T, F, S, S pills) */}
        <div className="flex items-center justify-between pt-2">
          {days.map((day, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={day.dateStr}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                className={`flex flex-col items-center justify-center transition-all px-2.5 py-1 rounded-xl ${isSelected
                    ? 'bg-[#282934] text-white shadow-sm font-semibold'
                    : 'text-[#62636B] hover:text-[#282934] hover:bg-slate-100'
                  }`}
              >
                <span className={`text-[11px] font-bold ${isSelected ? 'text-white' : ''}`}>
                  {day.dayShort}
                </span>
                <span className={`text-[10px] ${isSelected ? 'text-white font-medium' : 'text-[#777882]'}`}>
                  {day.dayNumber}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Day Detail Footer */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-[#62636B]">
        <div>
          Selected:{' '}
          <span className="font-semibold text-[#282934]">
            {activeDay.dayLabel}, {activeDay.dateStr}
          </span>
          {activeDay.isToday && (
            <span className="ml-2 inline-flex items-center justify-center rounded-[6px] bg-emerald-50 px-[7px] py-[3px] text-[10px] font-bold text-emerald-700 leading-none">
              Today
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 tabular-nums font-medium">
          <span>
            Present: <strong className="text-[#282934]">{activeDay.presentCount}</strong>
          </span>
          <span>
            Late: <strong className="text-amber-700">{activeDay.lateCount}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
