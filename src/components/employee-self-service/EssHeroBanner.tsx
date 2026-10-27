'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  CalendarCheck2,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Sunset,
} from 'lucide-react';

export interface EssHeroBannerAction {
  label?: string;
  href?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
}

export interface EssHeroBannerProps {
  /** Employee full or first name to display */
  employeeName?: string;
  /** Small eyebrow greeting label override (defaults to time-based greeting) */
  greetingLabel?: string;
  /** Main welcome headline override */
  headline?: string;
  /** Short supporting summary sentence */
  supportingText?: string;
  /** Dynamic bullet point items for supporting summary */
  summaryItems?: string[];
  /** Primary call-to-action button */
  primaryAction?: EssHeroBannerAction;
  /** Secondary call-to-action button */
  secondaryAction?: EssHeroBannerAction;
  /** Source path for the half-body mascot illustration */
  mascotSrc?: string;
  /** Alt text for the mascot illustration */
  mascotAlt?: string;
  /** Whether to render subtle status indicators */
  showFloatingBadges?: boolean;
  showStatusBadges?: boolean;
  /** Status indicator badge text overrides */
  floatingScheduleBadge?: string;
  floatingStatusBadge?: string;
  scheduleBadge?: string;
  statusBadge?: string;
  /** Additional container CSS classes */
  className?: string;
}

/**
 * Computes a warm, context-aware greeting based on local time.
 */
function getTimeBasedGreeting(): { label: string; icon: React.ReactNode } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return { label: 'GOOD MORNING', icon: <Sun className="h-3.5 w-3.5 text-amber-500" /> };
  }
  if (hour >= 12 && hour < 17) {
    return { label: 'GOOD AFTERNOON', icon: <Sunset className="h-3.5 w-3.5 text-orange-500" /> };
  }
  return { label: 'GOOD EVENING', icon: <Moon className="h-3.5 w-3.5 text-indigo-400" /> };
}

/**
 * WorkPulse Employee Self-Service (ESS) Dashboard Hero / Welcome Banner.
 * Refined to align with the HR dashboard design system and responsive tokens.
 */
export function EssHeroBanner({
  employeeName = 'Colleague',
  greetingLabel,
  headline,
  supportingText,
  summaryItems,
  primaryAction = {
    label: 'View Attendance',
    href: '/employee/attendance',
  },
  secondaryAction = {
    label: 'Open Leave Requests',
    href: '/employee/leave',
  },
  mascotSrc = '/branding/workpulse-mascot-half.png',
  mascotAlt = 'WorkPulse Assistant',
  showFloatingBadges = true,
  showStatusBadges,
  floatingScheduleBadge,
  floatingStatusBadge,
  scheduleBadge,
  statusBadge,
  className = '',
}: EssHeroBannerProps) {
  const dynamicGreeting = getTimeBasedGreeting();
  const effectiveGreeting = greetingLabel || dynamicGreeting.label;
  const [currentMascotSrc, setCurrentMascotSrc] = React.useState(mascotSrc);

  const effectiveHeadline = headline || `Welcome back, ${employeeName}.`;

  const defaultSummaryItems = [
    'You are scheduled today',
    'Leave requests up to date',
  ];
  const effectiveSummaryItems = summaryItems && summaryItems.length > 0
    ? summaryItems
    : (supportingText ? [supportingText] : defaultSummaryItems);

  // Status indicators (Shift Scheduled & Attendance Ready)
  const shouldShowBadges = showStatusBadges ?? showFloatingBadges ?? true;
  const effectiveScheduleBadge = scheduleBadge ?? floatingScheduleBadge ?? 'Shift Scheduled';
  const effectiveStatusBadge = statusBadge ?? floatingStatusBadge ?? 'Attendance Ready';

  // Semantic styles for schedule indicator
  const isRestDay = /rest\s*day/i.test(effectiveScheduleBadge) || /off/i.test(effectiveScheduleBadge);
  const scheduleBadgeClasses = isRestDay
    ? 'bg-slate-100 text-slate-700'
    : 'bg-[#C7A759]/15 text-[#282934]';
  const scheduleIconColor = isRestDay ? 'text-slate-500' : 'text-[#C7A759]';

  // Semantic styles for attendance readiness / status indicator
  const isAbsent = /absent/i.test(effectiveStatusBadge) || /error/i.test(effectiveStatusBadge);
  const isIncomplete =
    /incomplete/i.test(effectiveStatusBadge) ||
    /late/i.test(effectiveStatusBadge) ||
    /warning/i.test(effectiveStatusBadge);
  const statusBadgeClasses = isAbsent
    ? 'bg-red-50 text-red-700'
    : isIncomplete
    ? 'bg-amber-50 text-amber-800'
    : 'bg-emerald-50 text-emerald-800';
  const statusIconColor = isAbsent
    ? 'text-red-600'
    : isIncomplete
    ? 'text-amber-600'
    : 'text-emerald-600';

  return (
    <section
      aria-label="Welcome and daily summary banner"
      className={`relative overflow-hidden rounded-2xl bg-white p-5 sm:p-6 lg:p-7 shadow-[0_3px_16px_rgba(30,35,40,0.06)] ${className}`}
    >
      {/* Background ambient accents */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-teal-100/30 blur-3xl"
      />

      <div className="relative z-10 flex flex-col items-center justify-between gap-6 md:flex-row">
        {/* Left column: Text content, daily summary, status indicators, and action buttons */}
        <div className="w-full flex-1 space-y-3.5 text-left min-w-0">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/95 px-3 py-1 shadow-2xs">
            {dynamicGreeting.icon}
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
              {effectiveGreeting}
            </span>
          </div>

          {/* 1. Main welcome headline */}
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 break-words">
            {effectiveHeadline}
          </h1>

          {/* 2. Welcome description or supporting summary text */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm font-medium text-slate-600">
            {effectiveSummaryItems.map((item, index) => (
              <React.Fragment key={index}>
                {index > 0 && (
                  <span className="text-slate-300 font-bold select-none">•</span>
                )}
                <span className="inline-flex items-center text-slate-600">
                  {item}
                </span>
              </React.Fragment>
            ))}
          </div>

          {/* 3. Shift Scheduled and Attendance Ready indicators, displayed together in a compact horizontal row */}
          {shouldShowBadges && (effectiveScheduleBadge || effectiveStatusBadge) && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 pt-0.5">
              {effectiveScheduleBadge && (
                <div
                  className={`inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1 text-[11px] sm:text-[12px] font-medium leading-none ${scheduleBadgeClasses}`}
                >
                  <Clock className={`h-3.5 w-3.5 ${scheduleIconColor} shrink-0`} />
                  <span>{effectiveScheduleBadge}</span>
                </div>
              )}

              {effectiveStatusBadge && (
                <div
                  className={`inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1 text-[11px] sm:text-[12px] font-medium leading-none ${statusBadgeClasses}`}
                >
                  {isAbsent ? (
                    <AlertCircle className={`h-3.5 w-3.5 ${statusIconColor} shrink-0`} />
                  ) : (
                    <CheckCircle2 className={`h-3.5 w-3.5 ${statusIconColor} shrink-0`} />
                  )}
                  <span>{effectiveStatusBadge}</span>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {primaryAction?.href ? (
              <Link
                href={primaryAction.href}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--tenant-primary)] px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:brightness-95 active:scale-[0.99] focus-visible:outline-2"
              >
                {primaryAction.icon || <CalendarCheck2 className="h-4 w-4" />}
                <span>{primaryAction.label || 'View Attendance'}</span>
              </Link>
            ) : primaryAction?.onClick ? (
              <button
                type="button"
                onClick={primaryAction.onClick}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--tenant-primary)] px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:brightness-95 active:scale-[0.99] focus-visible:outline-2"
              >
                {primaryAction.icon || <CalendarCheck2 className="h-4 w-4" />}
                <span>{primaryAction.label || 'View Attendance'}</span>
              </button>
            ) : null}

            {secondaryAction?.href ? (
              <Link
                href={secondaryAction.href}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 active:scale-[0.99] focus-visible:outline-2"
              >
                {secondaryAction.icon || <FileText className="h-4 w-4 text-slate-500" />}
                <span>{secondaryAction.label || 'Open Leave Requests'}</span>
              </Link>
            ) : secondaryAction?.onClick ? (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 active:scale-[0.99] focus-visible:outline-2"
              >
                {secondaryAction.icon || <FileText className="h-4 w-4 text-slate-500" />}
                <span>{secondaryAction.label || 'Open Leave Requests'}</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Right column: Upper-half mascot illustration with proportional scaling */}
        <div className="relative flex shrink-0 items-end justify-center self-center md:self-end pt-2">
          {/* Mascot image container */}
          <div className="relative z-10 overflow-hidden">
            <Image
              src={currentMascotSrc}
              alt={mascotAlt}
              width={320}
              height={300}
              priority
              unoptimized
              onError={() => {
                if (currentMascotSrc === '/branding/workpulse-mascot-half.png') {
                  setCurrentMascotSrc('/workpulse-mascot-half.png');
                }
              }}
              className="h-36 w-auto object-contain object-bottom drop-shadow-sm sm:h-44 md:h-48 lg:h-52 transition-transform duration-300"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default EssHeroBanner;
