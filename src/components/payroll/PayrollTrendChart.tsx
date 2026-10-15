'use client';

import React, { useState } from 'react';
import { TrendingUp, Calendar } from 'lucide-react';
import { PayrollDashboardTrendPoint } from '@/features/payroll/queries';
import { formatStatusLabel } from '@/lib/ui/format-status';

interface PayrollTrendChartProps {
  trendPoints: PayrollDashboardTrendPoint[];
  currentPeriodName?: string;
}

export function PayrollTrendChart({
  trendPoints,
  currentPeriodName,
}: PayrollTrendChartProps) {
  const [periodRange, setPeriodRange] = useState<'3' | '6' | '12'>('6');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Filter based on selected period count
  const rangeCount = Number(periodRange);
  const visiblePoints = trendPoints.slice(-rangeCount);

  // SVG Chart Setup
  const width = 640;
  const height = 240;
  const paddingX = 48;
  const paddingTop = 36;
  const paddingBottom = 40;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingTop - paddingBottom;

  // Max value calculation for y-axis scaling
  const maxGross = Math.max(...visiblePoints.map((p) => p.gross), 0);
  const maxNet = Math.max(...visiblePoints.map((p) => p.net), 0);
  const rawMax = Math.max(maxGross, maxNet);
  // Ensure non-zero ceiling with 15% headroom
  const yMax = rawMax > 0 ? Math.ceil(rawMax * 1.15) : 100000;

  // Compute point coordinates
  const coordinates = visiblePoints.map((point, idx) => {
    const x =
      visiblePoints.length > 1
        ? paddingX + (idx / (visiblePoints.length - 1)) * chartWidth
        : width / 2;
    const yGross =
      paddingTop + chartHeight - (point.gross / yMax) * chartHeight;
    const yNet =
      paddingTop + chartHeight - (point.net / yMax) * chartHeight;

    return {
      point,
      x,
      yGross,
      yNet,
    };
  });

  // Generate cubic bezier smooth paths
  function createCurvePath(coords: { x: number; y: number }[]) {
    if (coords.length === 0) return '';
    if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;

    let path = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p0 = i > 0 ? coords[i - 1] : coords[i];
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const p3 = i != coords.length - 2 ? coords[i + 2] : p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return path;
  }

  const grossPath = createCurvePath(
    coordinates.map((c) => ({ x: c.x, y: c.yGross }))
  );
  const netPath = createCurvePath(
    coordinates.map((c) => ({ x: c.x, y: c.yNet }))
  );

  // Closed area path for net curve with gradient fill
  const netAreaPath =
    coordinates.length > 1
      ? `${netPath} L ${coordinates[coordinates.length - 1].x} ${
          paddingTop + chartHeight
        } L ${coordinates[0].x} ${paddingTop + chartHeight} Z`
      : '';

  // Check if any visible points have actual calculated financial data
  const hasCalculatedTrendData = visiblePoints.length > 0 && rawMax > 0;

  // Grid tick values (3 horizontal ticks)
  const gridTicks = [
    { value: yMax, label: `₱${(yMax / 1000).toFixed(0)}k`, y: paddingTop },
    {
      value: yMax * 0.5,
      label: `₱${((yMax * 0.5) / 1000).toFixed(0)}k`,
      y: paddingTop + chartHeight * 0.5,
    },
    { value: 0, label: '₱0', y: paddingTop + chartHeight },
  ];

  // Currently active or hovered point
  const activePoint =
    hasCalculatedTrendData && hoveredIndex !== null && coordinates[hoveredIndex]
      ? coordinates[hoveredIndex]
      : hasCalculatedTrendData && coordinates.length > 0
      ? coordinates[coordinates.length - 1]
      : null;

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs flex flex-col justify-between">
      {/* 1. Header with Range Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[var(--tenant-primary,#0f766e)]" />
            Payroll Trend
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {currentPeriodName
              ? `Gross and net payroll trend up to ${currentPeriodName}.`
              : 'Gross and net payroll across recent payroll periods.'}
          </p>
        </div>

        {/* Range Switcher */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 self-start sm:self-auto">
          {(['3', '6', '12'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setPeriodRange(r);
                setHoveredIndex(null);
              }}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                periodRange === r
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {r} Periods
            </button>
          ))}
        </div>
      </div>

      {/* 2. Headline Callout & Legend */}
      <div className="flex flex-wrap items-baseline justify-between gap-4 pt-4 pb-2">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
            {activePoint ? activePoint.point.periodName : 'Latest Net Payroll'}
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              {activePoint ? activePoint.point.netFormatted : '—'}
            </span>
            {activePoint ? (
              <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                activePoint.point.isFinalized
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {formatStatusLabel(activePoint.point.status)}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                Awaiting calculation
              </span>
            )}
          </div>
        </div>

        {/* Legend */}
        {hasCalculatedTrendData && (
          <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
              <span>Gross Pay</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--tenant-primary,#0f766e)]" />
              <span className="font-semibold text-slate-900">Net Pay</span>
            </div>
          </div>
        )}
      </div>

      {/* 3. SVG Area / Line Chart or Clean Empty State */}
      <div className="relative mt-2 w-full">
        {visiblePoints.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-xl bg-slate-50/75 border border-dashed border-slate-200 p-6 text-center">
            <Calendar className="h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">
              No historical payroll periods found
            </p>
            <p className="text-xs text-slate-400 mt-0.5 max-w-sm">
              Create payroll periods and generate entries to track trends in gross compensation, deductions, and net pay.
            </p>
          </div>
        ) : !hasCalculatedTrendData ? (
          <div className="flex h-48 flex-col items-center justify-center rounded-xl bg-slate-50/75 border border-dashed border-slate-200 p-6 text-center">
            <TrendingUp className="h-8 w-8 text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">
              Awaiting payroll calculations
            </p>
            <p className="text-xs text-slate-400 mt-0.5 max-w-sm">
              Payroll has not been calculated for the selected periods yet. Generate payroll entries to visualize gross and net compensation trends.
            </p>
          </div>
        ) : (
          <div className="relative">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto overflow-visible select-none"
              aria-label="Payroll trend chart"
            >
              <defs>
                <linearGradient id="netGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--tenant-primary, #0f766e)"
                    stopOpacity="0.18"
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--tenant-primary, #0f766e)"
                    stopOpacity="0.0"
                  />
                </linearGradient>
              </defs>

              {/* Horizontal Grid lines */}
              {gridTicks.map((tick, i) => (
                <g key={i}>
                  <line
                    x1={paddingX}
                    y1={tick.y}
                    x2={width - paddingX}
                    y2={tick.y}
                    stroke="#f1f5f9"
                    strokeWidth="1"
                    strokeDasharray={i === gridTicks.length - 1 ? undefined : '3 3'}
                  />
                  <text
                    x={paddingX - 8}
                    y={tick.y + 3}
                    textAnchor="end"
                    className="fill-slate-400 text-[10px] font-mono"
                  >
                    {tick.label}
                  </text>
                </g>
              ))}

              {/* Net Area fill */}
              {netAreaPath && (
                <path d={netAreaPath} fill="url(#netGradient)" />
              )}

              {/* Gross Curve Line */}
              {grossPath && (
                <path
                  d={grossPath}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                />
              )}

              {/* Net Curve Line */}
              {netPath && (
                <path
                  d={netPath}
                  fill="none"
                  stroke="var(--tenant-primary, #0f766e)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              )}

              {/* X-Axis Labels & Vertical Guidelines on Hover */}
              {coordinates.map((coord, idx) => {
                const isHovered = hoveredIndex === idx;
                return (
                  <g key={coord.point.periodId}>
                    {/* Vertical guideline on hover */}
                    {isHovered && (
                      <line
                        x1={coord.x}
                        y1={paddingTop}
                        x2={coord.x}
                        y2={paddingTop + chartHeight}
                        stroke="#cbd5e1"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                    )}

                    {/* Gross Point */}
                    <circle
                      cx={coord.x}
                      cy={coord.yGross}
                      r={isHovered ? 4.5 : 3}
                      fill="#ffffff"
                      stroke="#94a3b8"
                      strokeWidth="2"
                    />

                    {/* Net Point */}
                    <circle
                      cx={coord.x}
                      cy={coord.yNet}
                      r={isHovered ? 5.5 : 4}
                      fill="#ffffff"
                      stroke="var(--tenant-primary, #0f766e)"
                      strokeWidth="2.5"
                    />

                    {/* Interactive invisible hover hit area */}
                    <rect
                      x={coord.x - (chartWidth / coordinates.length) / 2}
                      y={0}
                      width={chartWidth / coordinates.length}
                      height={height}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredIndex(idx)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    />

                    {/* X-axis label */}
                    <text
                      x={coord.x}
                      y={paddingTop + chartHeight + 18}
                      textAnchor="middle"
                      className={`text-[11px] font-medium transition ${
                        isHovered
                          ? 'fill-slate-900 font-bold'
                          : 'fill-slate-400'
                      }`}
                    >
                      {coord.point.periodLabel}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip Card (positioned dynamically) */}
            {hoveredIndex !== null && coordinates[hoveredIndex] && (
              <div
                className="pointer-events-none absolute z-10 rounded-xl border border-slate-200/90 bg-white p-3 shadow-lg transition-all"
                style={{
                  left: `${(coordinates[hoveredIndex].x / width) * 100}%`,
                  top: '12%',
                  transform: 'translate(-50%, -100%)',
                }}
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
                  <span className="text-[11px] font-bold text-slate-900">
                    {coordinates[hoveredIndex].point.periodName}
                  </span>
                  <span className="rounded bg-slate-100 px-1 py-0.2 text-[9px] font-bold text-slate-600">
                    {formatStatusLabel(coordinates[hoveredIndex].point.status)}
                  </span>
                </div>
                <div className="mt-2 space-y-1 text-left text-xs">
                  <div className="flex items-center justify-between gap-4 text-slate-500">
                    <span>Gross:</span>
                    <span className="font-semibold text-slate-700">
                      {coordinates[hoveredIndex].point.grossFormatted}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-slate-500">
                    <span>Deductions:</span>
                    <span className="font-semibold text-slate-700">
                      {coordinates[hoveredIndex].point.deductionsFormatted}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-1 font-bold text-slate-900">
                    <span>Net Pay:</span>
                    <span className="text-[var(--tenant-primary,#0f766e)]">
                      {coordinates[hoveredIndex].point.netFormatted}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
