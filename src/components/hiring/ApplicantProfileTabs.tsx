'use client';

import React, { useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export type ApplicantTabKey =
  | 'overview'
  | 'documents'
  | 'interviews'
  | 'assessments'
  | 'offers'
  | 'onboarding'
  | 'history';

interface TabItem {
  key: ApplicantTabKey;
  label: string;
  badge?: number | string | null;
}

interface ApplicantProfileTabsProps {
  activeTab: ApplicantTabKey;
  onTabChange?: (tab: ApplicantTabKey) => void;
  documentCount?: number;
  interviewCount?: number;
  assessmentCount?: number;
  offerCount?: number;
  onboardingTaskCount?: number;
}

export function ApplicantProfileTabs({
  activeTab,
  onTabChange,
  documentCount,
  interviewCount,
  assessmentCount,
  offerCount,
  onboardingTaskCount,
}: ApplicantProfileTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabs: TabItem[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'documents', label: 'Documents', badge: documentCount },
    { key: 'interviews', label: 'Interviews & Evaluations', badge: interviewCount },
    { key: 'assessments', label: 'Assessments', badge: assessmentCount },
    { key: 'offers', label: 'Offers & Contract', badge: offerCount },
    { key: 'onboarding', label: 'Onboarding', badge: onboardingTaskCount },
    { key: 'history', label: 'History' },
  ];

  const handleSelectTab = useCallback(
    (key: ApplicantTabKey) => {
      if (onTabChange) {
        onTabChange(key);
      }
      const params = new URLSearchParams(searchParams?.toString() || '');
      if (key === 'overview') {
        params.delete('tab');
      } else {
        params.set('tab', key);
      }
      const queryString = params.toString();
      const url = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(url, { scroll: false });
    },
    [onTabChange, pathname, router, searchParams]
  );

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = index;
    if (e.key === 'ArrowRight') {
      nextIndex = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = tabs.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    handleSelectTab(tabs[nextIndex].key);
    // Focus target element
    const tabElements = document.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabElements[nextIndex]?.focus();
  };

  return (
    <div className="border-b border-slate-200">
      <nav
        role="tablist"
        aria-label="Applicant Profile Sections"
        className="flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none -mb-px"
      >
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              role="tab"
              id={`tab-${tab.key}`}
              aria-selected={isActive}
              aria-controls={`panel-${tab.key}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => handleSelectTab(tab.key)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`group inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 sm:px-4 py-3 text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'border-[var(--tenant-primary)] text-slate-900'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
              }`}
            >
              <span>{tab.label}</span>

              {tab.badge !== undefined && tab.badge !== null && (
                <span
                  className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
