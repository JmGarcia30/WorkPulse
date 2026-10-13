'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Calendar, Clock, ArrowRight, ExternalLink } from 'lucide-react';
import { ScheduleItem } from '@/features/dashboard/read-model';

interface HrSchedulePanelProps {
  currentDateStr: string;
  days: {
    dateStr: string;
    dayName: string;
    dayNumber: number;
    isToday: boolean;
    eventCount: number;
  }[];
  events: ScheduleItem[];
  timeZone: string;
}

export function HrSchedulePanel({
  currentDateStr,
  days,
  events,
  timeZone,
}: HrSchedulePanelProps) {
  // Currently selected date filter; default to today if in days, otherwise first day
  const todayMatch = days.find((d) => d.isToday)?.dateStr ?? days[0]?.dateStr ?? currentDateStr;
  const [selectedDate, setSelectedDate] = useState<string>(todayMatch);
  const [showAllWeek, setShowAllWeek] = useState<boolean>(false);

  // Format month and day for the header (e.g. "October 2026")
  const selectedDateObj = new Date(`${selectedDate}T00:00:00Z`);
  const headerDateLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone,
  }).format(selectedDateObj);

  // Filter events based on selected date or show all week
  const filteredEvents = showAllWeek
    ? events
    : events.filter((e) => e.dateStr === selectedDate);

  // Category badge colors
  const getBadgeStyle = (type: ScheduleItem['type']) => {
    switch (type) {
      case 'INTERVIEW':
        return {
          dotColor: 'border-purple-600 bg-purple-50',
          cardBg: 'bg-purple-50/40 hover:bg-purple-50/70 border-purple-100',
          typeBadge: 'bg-purple-100/70 text-purple-700',
        };
      case 'PROBATION':
        return {
          dotColor: 'border-amber-600 bg-amber-50',
          cardBg: 'bg-amber-50/40 hover:bg-amber-50/70 border-amber-100',
          typeBadge: 'bg-amber-100/70 text-amber-800',
        };
      case 'PAYROLL':
        return {
          dotColor: 'border-emerald-600 bg-emerald-50',
          cardBg: 'bg-emerald-50/40 hover:bg-emerald-50/70 border-emerald-100',
          typeBadge: 'bg-emerald-100/70 text-emerald-800',
        };
      case 'LEAVE':
        return {
          dotColor: 'border-blue-600 bg-blue-50',
          cardBg: 'bg-blue-50/40 hover:bg-blue-50/70 border-blue-100',
          typeBadge: 'bg-blue-100/70 text-blue-700',
        };
      default:
        return {
          dotColor: 'border-slate-500 bg-slate-50',
          cardBg: 'bg-slate-50 hover:bg-slate-100 border-slate-200',
          typeBadge: 'bg-slate-100 text-slate-700',
        };
    }
  };

  return (
    <div className="flex flex-col justify-between rounded-2xl bg-white p-5 border border-slate-200/80 h-full">
      {/* Top Header */}
      <div>
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Schedule
            </h2>
            <span className="text-xs font-semibold text-slate-400">
              ({events.length} upcoming)
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowAllWeek(!showAllWeek)}
            className={`text-xs font-semibold px-2 py-1 rounded-lg transition-colors ${
              showAllWeek
                ? 'bg-slate-900 text-white'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {showAllWeek ? 'Show Selected Day' : 'View All Week'}
          </button>
        </div>

        {/* Date Title and Day Navigation Strip */}
        <div className="flex items-center justify-between pt-1 pb-3">
          <span className="text-sm font-bold text-slate-800">
            {headerDateLabel}
          </span>
          <div className="flex items-center gap-1 text-slate-400">
            <Calendar className="h-4 w-4" />
          </div>
        </div>

        {/* Horizontal 7-Day Pills (matching reference Sat 22, Sun 23, Mon 23, Tue 24...) */}
        <div className="grid grid-cols-7 gap-1.5 pb-5 border-b border-slate-100">
          {days.map((d) => {
            const isSelected = !showAllWeek && d.dateStr === selectedDate;
            const shortName = d.dayName.slice(0, 3);

            return (
              <button
                key={d.dateStr}
                type="button"
                onClick={() => {
                  setSelectedDate(d.dateStr);
                  setShowAllWeek(false);
                }}
                className={`group relative flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span className="text-[11px] font-medium tracking-tight">
                  {shortName}
                </span>
                <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                  {d.dayNumber}
                </span>

                {/* Event count indicator dot */}
                {d.eventCount > 0 && (
                  <span
                    className={`mt-1 h-1 w-1 rounded-full ${
                      isSelected ? 'bg-emerald-400' : 'bg-emerald-600'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Timeline Event List (matching reference image timeline cards) */}
      <div className="flex-1 my-4 space-y-4 overflow-y-auto max-h-[380px] pr-1">
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
            <Clock className="h-8 w-8 stroke-1 text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-600">
              No scheduled HR activities
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {showAllWeek ? 'No events found for this week.' : 'No items for this date.'}
            </p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-3.5 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1.5px] before:bg-slate-200">
            {filteredEvents.map((evt) => {
              const style = getBadgeStyle(evt.type);

              return (
                <div key={evt.id} className="relative flex items-start gap-3">
                  {/* Timeline circle marker */}
                  <span
                    className={`absolute -left-6 top-3 h-3 w-3 rounded-full border-2 ${style.dotColor} shadow-xs`}
                  />

                  {/* Event content card */}
                  <Link
                    href={evt.href}
                    className={`group flex-1 rounded-xl p-3 border transition-all ${style.cardBg}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {/* Time or Date Label */}
                        <span className="text-[11px] font-bold text-slate-700 tabular-nums">
                          {evt.timeStr ? evt.timeStr : evt.dateStr}
                        </span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${style.typeBadge}`}>
                          {evt.typeLabel}
                        </span>
                      </div>
                      <ExternalLink className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    <div className="mt-1">
                      <div className="text-xs font-bold text-slate-900 group-hover:text-slate-950">
                        {evt.title}
                      </div>
                      <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {evt.subtitle}
                        {evt.departmentOrInfo ? ` • ${evt.departmentOrInfo}` : ''}
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer link to schedule management */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-400 font-medium">
          HR Calendar Timeline
        </span>
        <Link
          href="/dashboard/hiring/interviews"
          className="font-semibold text-slate-700 hover:text-slate-950 inline-flex items-center gap-1 transition-colors"
        >
          View Interviews
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
