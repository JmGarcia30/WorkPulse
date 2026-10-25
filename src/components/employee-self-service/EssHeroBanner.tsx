'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  CalendarCheck2, 
  FileText, 
  Clock, 
  Sparkles, 
  CheckCircle2, 
  Briefcase,
  ArrowRight,
  Sun,
  Moon,
  Sunset
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
  /** Whether to render subtle floating workplace accent badges */
  showFloatingBadges?: boolean;
  /** Floating badge text overrides */
  floatingScheduleBadge?: string;
  floatingStatusBadge?: string;
  /** Additional container CSS classes */
  className?: string;
}

/**
 * Computes a warm, context-aware greeting based on local time.
 */
function getTimeBasedGreeting(): { label: string; icon: React.ReactNode } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return { label: 'GOOD MORNING', icon: <Sun className="h-3.5 w-3.5 text-amber-500 animate-pulse" /> };
  }
  if (hour >= 12 && hour < 17) {
    return { label: 'GOOD AFTERNOON', icon: <Sunset className="h-3.5 w-3.5 text-orange-500" /> };
  }
  return { label: 'GOOD EVENING', icon: <Moon className="h-3.5 w-3.5 text-indigo-400" /> };
}

/**
 * WorkPulse Employee Self-Service (ESS) Dashboard Hero / Welcome Banner.
 *
 * Implements a clean, SaaS-grade hero section with generous whitespace,
 * dynamic employee headline, customizable quick-actions, and the half-body
 * WorkPulse mascot assistant with subtle workplace accents.
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
  floatingScheduleBadge = 'Schedule Active',
  floatingStatusBadge = 'Attendance On Track',
  className = '',
}: EssHeroBannerProps) {
  const dynamicGreeting = getTimeBasedGreeting();
  const effectiveGreeting = greetingLabel || dynamicGreeting.label;

  const [currentMascotSrc, setCurrentMascotSrc] = React.useState(mascotSrc);

  // Main welcome headline
  const effectiveHeadline = headline || `Here\u2019s what\u2019s happening today, ${employeeName}.`;

  // Supporting summary items fallback
  const defaultSummaryItems = [
    'You are scheduled today',
    '1 pending leave request',
    '2 unread announcements',
  ];
  const effectiveSummaryItems = summaryItems && summaryItems.length > 0 
    ? summaryItems 
    : (supportingText ? [supportingText] : defaultSummaryItems);

  return (
    <section
      aria-label="Welcome and daily summary banner"
      className={`relative overflow-hidden rounded-3xl border border-slate-200/90 bg-gradient-to-br from-white via-[#fcfdfe] to-[#f4f8f7] p-6 shadow-[0_4px_24px_-4px_rgba(15,23,42,0.06)] sm:p-8 lg:p-9 transition-all ${className}`}
    >
      {/* Decorative ambient background accents */}
      <div 
        aria-hidden="true" 
        className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-teal-100/40 blur-3xl"
      />
      <div 
        aria-hidden="true" 
        className="pointer-events-none absolute right-40 bottom-0 h-48 w-48 rounded-full bg-slate-200/30 blur-2xl"
      />

      <div className="relative z-10 flex flex-col items-center justify-between gap-6 lg:flex-row lg:items-center">
        {/* Left column: Text content, daily summary, and action buttons */}
        <div className="flex-1 space-y-4 text-left">
          {/* Eyebrow badge / Small greeting label */}
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 px-3 py-1 shadow-[0_1px_2px_rgba(0,0,0,0.04)] backdrop-blur-xs">
            {dynamicGreeting.icon}
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-600">
              {effectiveGreeting}
            </span>
          </div>

          {/* Main welcome headline */}
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl lg:text-[2.15rem] lg:leading-[1.18]">
            {effectiveHeadline}
          </h1>

          {/* Short supporting summary text */}
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm font-medium text-slate-600 sm:text-[15px]">
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

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-3">
            {/* Primary button */}
            {primaryAction?.href ? (
              <Link
                href={primaryAction.href}
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--tenant-primary,#17324d)] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-150 hover:bg-[#0f2133] hover:shadow active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[var(--tenant-primary,#17324d)] focus-visible:ring-offset-2"
              >
                {primaryAction.icon || <CalendarCheck2 className="h-4 w-4 transition-transform group-hover:scale-110" />}
                <span>{primaryAction.label || 'View Attendance'}</span>
              </Link>
            ) : primaryAction?.onClick ? (
              <button
                type="button"
                onClick={primaryAction.onClick}
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--tenant-primary,#17324d)] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-150 hover:bg-[#0f2133] hover:shadow active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[var(--tenant-primary,#17324d)] focus-visible:ring-offset-2"
              >
                {primaryAction.icon || <CalendarCheck2 className="h-4 w-4 transition-transform group-hover:scale-110" />}
                <span>{primaryAction.label || 'View Attendance'}</span>
              </button>
            ) : null}

            {/* Secondary button */}
            {secondaryAction?.href ? (
              <Link
                href={secondaryAction.href}
                className="group inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300/90 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all duration-150 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              >
                {secondaryAction.icon || <FileText className="h-4 w-4 text-slate-500 transition-colors group-hover:text-slate-700" />}
                <span>{secondaryAction.label || 'Open Leave Requests'}</span>
              </Link>
            ) : secondaryAction?.onClick ? (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                className="group inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300/90 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all duration-150 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              >
                {secondaryAction.icon || <FileText className="h-4 w-4 text-slate-500 transition-colors group-hover:text-slate-700" />}
                <span>{secondaryAction.label || 'Open Leave Requests'}</span>
              </button>
            ) : null}
          </div>
        </div>

        {/* Right column: Upper-half mascot illustration with subtle floating workplace accents */}
        <div className="relative flex shrink-0 items-end justify-center self-center lg:self-end pt-2 sm:pt-4 lg:pt-0">
          {/* Subtle floating workplace badge: Schedule (Top-Left of mascot) */}
          {showFloatingBadges && (
            <div 
              className="absolute -left-6 top-6 z-20 hidden sm:inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/95 px-3 py-1.5 shadow-[0_4px_12px_rgba(15,23,42,0.08)] backdrop-blur-md transition-transform hover:-translate-y-0.5"
            >
              <span className="flex h-2 w-2 rounded-full bg-teal-500 animate-pulse" />
              <Clock className="h-3.5 w-3.5 text-teal-700" />
              <span className="text-xs font-bold text-slate-700">{floatingScheduleBadge}</span>
            </div>
          )}

          {/* Subtle floating workplace badge: Attendance Status (Top-Right of mascot) */}
          {showFloatingBadges && (
            <div 
              className="absolute -right-3 top-2 z-20 hidden md:inline-flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-white/95 px-3 py-1.5 shadow-[0_4px_12px_rgba(15,23,42,0.08)] backdrop-blur-md transition-transform hover:-translate-y-0.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-xs font-bold text-slate-700">{floatingStatusBadge}</span>
            </div>
          )}

          {/* Subtle background circular glow behind mascot */}
          <div 
            aria-hidden="true" 
            className="pointer-events-none absolute inset-x-0 bottom-0 h-44 rounded-full bg-gradient-to-t from-teal-100/50 via-slate-100/30 to-transparent blur-xl"
          />

          {/* Mascot image container - half body only */}
          <div className="relative z-10 overflow-hidden pt-2">
            <Image
              src={currentMascotSrc}
              alt={mascotAlt}
              width={385}
              height={372}
              priority
              unoptimized
              onError={() => {
                if (currentMascotSrc === '/branding/workpulse-mascot-half.png') {
                  setCurrentMascotSrc('/workpulse-mascot-half.png');
                }
              }}
              className="h-52 w-auto object-contain object-bottom drop-shadow-[0_12px_24px_rgba(15,23,42,0.09)] sm:h-60 md:h-64 lg:h-[268px] transition-transform duration-300 hover:scale-[1.02]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default EssHeroBanner;
