'use client';

import React from 'react';
import {
  User,
  ShieldCheck,
  History,
  Scale,
  FileCheck2,
  KeyRound,
  AlertCircle,
} from 'lucide-react';
import { TenantLink } from '@/components/ui/TenantLink';

export type ProfileTabId =
  | 'overview'
  | 'probation'
  | 'history'
  | 'decisions'
  | 'compliance'
  | 'account';

interface TabItem {
  id: ProfileTabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: React.ReactNode;
}

interface EmployeeProfileTabsProps {
  employeeId: string;
  activeTab: ProfileTabId;
  badges?: {
    probationNeedsAttention?: boolean;
    historyCount?: number;
    decisionsCount?: number;
    complianceTasksTotal?: number;
    complianceTasksSatisfied?: number;
  };
}

export function EmployeeProfileTabs({
  employeeId,
  activeTab,
  badges = {},
}: EmployeeProfileTabsProps) {
  const tabs: TabItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: User,
    },
    {
      id: 'probation',
      label: 'Probation',
      icon: ShieldCheck,
      badge: badges.probationNeedsAttention ? (
        <span
          className="inline-flex h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white"
          title="Attention required"
        />
      ) : null,
    },
    {
      id: 'history',
      label: 'Employment History',
      icon: History,
      badge: badges.historyCount != null && badges.historyCount > 0 ? (
        <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-600">
          {badges.historyCount}
        </span>
      ) : null,
    },
    {
      id: 'decisions',
      label: 'Decisions & Audit',
      icon: Scale,
      badge: badges.decisionsCount != null && badges.decisionsCount > 0 ? (
        <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-600">
          {badges.decisionsCount}
        </span>
      ) : null,
    },
    {
      id: 'compliance',
      label: 'Compliance',
      icon: FileCheck2,
    },
    {
      id: 'account',
      label: 'ESS Account',
      icon: KeyRound,
    },
    // Future Exit & Clearance tab placeholder (not implemented yet, per H10 requirements)
  ];

  return (
    <div className="border-b border-slate-200">
      <nav
        aria-label="Employee Profile Tabs"
        className="-mb-px flex space-x-1 sm:space-x-2 overflow-x-auto pb-px"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const Icon = tab.icon;
          return (
            <TenantLink
              key={tab.id}
              href={`/dashboard/employees/${employeeId}?tab=${tab.id}`}
              className={`group inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold transition ${isActive
                  ? 'border-[var(--tenant-primary)] text-[var(--tenant-primary)] bg-slate-50/50'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800 hover:bg-slate-50/30'
                }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                className={`h-4 w-4 shrink-0 transition ${isActive
                    ? 'text-[var(--tenant-primary)]'
                    : 'text-slate-400 group-hover:text-slate-600'
                  }`}
              />
              <span>{tab.label}</span>
              {tab.badge}
            </TenantLink>
          );
        })}
      </nav>
    </div>
  );
}
