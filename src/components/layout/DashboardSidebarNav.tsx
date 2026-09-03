'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Kanban,
  Briefcase,
  Users,
  Calendar,
  Award,
  FileText,
  UserCheck,
  Building2,
  ExternalLink,
} from 'lucide-react';

interface DashboardSidebarNavProps {
  orgSlug?: string;
}

export function DashboardSidebarNav({ orgSlug }: DashboardSidebarNavProps) {
  const pathname = usePathname();

  const isLinkActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  const navGroups = [
    {
      label: null,
      items: [
        {
          href: '/dashboard',
          label: 'Overview',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      label: 'Talent Acquisition',
      items: [
        {
          href: '/dashboard/hiring/pipeline',
          label: 'ATS Pipeline',
          icon: Kanban,
        },
        {
          href: '/dashboard/hiring/jobs',
          label: 'Job Postings',
          icon: Briefcase,
        },
        {
          href: '/dashboard/hiring/applicants',
          label: 'Applicants',
          icon: Users,
        },
      ],
    },
    {
      label: 'Evaluation & Offers',
      items: [
        {
          href: '/dashboard/hiring/interviews',
          label: 'Interviews',
          icon: Calendar,
        },
        {
          href: '/dashboard/hiring/assessments',
          label: 'Assessments',
          icon: Award,
        },
        {
          href: '/dashboard/hiring/offers',
          label: 'Offers',
          icon: FileText,
        },
      ],
    },
    {
      label: 'Employee Journey',
      items: [
        {
          href: '/dashboard/hiring/onboarding',
          label: 'Onboarding',
          icon: UserCheck,
        },
      ],
    },
  ];

  return (
    <nav className="p-3 space-y-4">
      {navGroups.map((group, idx) => (
        <div key={idx} className="space-y-1">
          {group.label && (
            <div className="pt-2 pb-1 px-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                {group.label}
              </span>
            </div>
          )}

          {group.items.map((item) => {
            const active = isLinkActive(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center justify-between px-3.5 py-2.5 text-xs rounded-2xl transition-all duration-150 ${
                  active
                    ? 'bg-[#181A1C] text-white font-bold shadow-sm'
                    : 'text-[#6B7280] hover:text-[#181A1C] hover:bg-[#F4F5F7] font-semibold'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      active
                        ? 'text-white'
                        : 'text-[#9CA3AF] group-hover:text-[#181A1C]'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {active && (
                  <span className="h-2 w-2 rounded-full bg-[#22C55E] shrink-0" />
                )}
              </Link>
            );
          })}
        </div>
      ))}

      {/* Public Career Portal Link */}
      {orgSlug && (
        <div className="pt-3 border-t border-[#E8EAED] space-y-1">
          <div className="pt-1 pb-1 px-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
              Public Portals
            </span>
          </div>
          <Link
            href={`/careers/${orgSlug}`}
            target="_blank"
            className="group flex items-center justify-between px-3.5 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#181A1C] hover:bg-[#F4F5F7] rounded-2xl transition"
          >
            <div className="flex items-center gap-3 truncate">
              <Building2 className="h-4 w-4 text-[#9CA3AF] group-hover:text-[#181A1C] shrink-0" />
              <span className="truncate">Career Site</span>
            </div>
            <ExternalLink className="h-3 w-3 text-[#9CA3AF] group-hover:text-[#181A1C] shrink-0" />
          </Link>
        </div>
      )}
    </nav>
  );
}
