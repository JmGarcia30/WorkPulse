'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Banknote,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  Clock3,
  ExternalLink,
  LayoutDashboard,
  Settings,
  Users,
} from 'lucide-react';
import { Role } from '@prisma/client';
import {
  isChildRouteActive,
  isSectionActive,
  resolveTenantHref,
} from '@/lib/tenant/navigation';

type NavItem = { href: string; label: string };

type SectionItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  sectionPrefix?: string;
  children?: NavItem[];
};

export function DashboardSidebarNav({
  orgSlug,
  role,
  onNavigate,
}: {
  orgSlug?: string;
  role: Role;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const hrAccess = role === Role.ORGANIZATION_ADMIN || role === Role.HR_ADMIN;

  const sections = useMemo<SectionItem[]>(
    () => [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      {
        href: '/dashboard/hiring/pipeline',
        sectionPrefix: '/dashboard/hiring',
        label: 'Hiring',
        icon: BriefcaseBusiness,
        children: [
          { href: '/dashboard/hiring/pipeline', label: 'Hiring Pipeline' },
          { href: '/dashboard/hiring/jobs', label: 'Job Openings' },
          { href: '/dashboard/hiring/applicants', label: 'Applicants' },
          { href: '/dashboard/hiring/interviews', label: 'Interviews' },
          { href: '/dashboard/hiring/assessments', label: 'Assessments' },
          { href: '/dashboard/hiring/offers', label: 'Offers' },
          { href: '/dashboard/hiring/onboarding', label: 'Onboarding' },
        ],
      },
      ...(hrAccess
        ? [
          {
            href: '/dashboard/employees',
            sectionPrefix: '/dashboard/employees',
            label: 'Employees',
            icon: Users,
            children: [
              { href: '/dashboard/employees', label: 'Employee Records' },
              { href: '/dashboard/employees/exit', label: 'Exit Management' },
            ],
          },
          {
            href: '/dashboard/attendance',
            sectionPrefix: '/dashboard/attendance',
            label: 'Attendance',
            icon: Clock3,
            children: [
              { href: '/dashboard/attendance', label: 'Employee Attendance' },
              { href: '/dashboard/attendance/schedules', label: 'Work Schedules' },
            ],
          },
          {
            href: '/dashboard/leave',
            sectionPrefix: '/dashboard/leave',
            label: 'Leave',
            icon: CalendarDays,
            children: [
              { href: '/dashboard/leave', label: 'Leave Requests' },
              { href: '/dashboard/leave/balances', label: 'Leave Balances' },
              { href: '/dashboard/leave/settings', label: 'Leave Settings' },
            ],
          },
          { href: '/dashboard/payroll', label: 'Payroll', icon: Banknote },
          { href: '/dashboard/analytics', label: 'Analytics', icon: ChartNoAxesCombined },
        ]
        : []),
      ...(hrAccess ? [{
        href: '/dashboard/organization', label: 'Settings', icon: Settings, sectionPrefix: '/dashboard/settings', children: [
          { href: '/dashboard/organization', label: 'Organization Settings' },
          { href: '/dashboard/settings/email-integration', label: 'Email Integration' },
          { href: '/dashboard/settings/exit', label: 'Resignation Notice Policy' },
        ]
      }] : [{ href: '/dashboard/organization', label: 'Organization Settings', icon: Settings }]),
    ],
    [hrAccess]
  );

  // Manual toggle state overrides. Keys are section.label.
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

  // Auto-expand the section containing the current page whenever pathname changes
  useEffect(() => {
    sections.forEach((sec) => {
      if (sec.children && isSectionActive(sec.href, pathname, sec.sectionPrefix)) {
        setExpandedMap((prev) => ({
          ...prev,
          [sec.label]: true,
        }));
      }
    });
  }, [pathname, sections]);

  const toggleSection = (label: string, defaultExpanded: boolean) => {
    setExpandedMap((prev) => {
      const current = prev[label] ?? defaultExpanded;
      return {
        ...prev,
        [label]: !current,
      };
    });
  };

  return (
    <nav aria-label="Main navigation" className="space-y-1 pl-[26px] pr-3 py-2">
      {sections.map((section) => {
        const Icon = section.icon;
        const sectionActive = isSectionActive(section.href, pathname, section.sectionPrefix);
        const hasChildren = Boolean(section.children && section.children.length > 0);
        const isExpanded = hasChildren
          ? (expandedMap[section.label] ?? sectionActive)
          : false;

        const subMenuId = `submenu-${section.label.toLowerCase().replace(/\s+/g, '-')}`;

        return (
          <div key={section.label}>
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleSection(section.label, sectionActive)}
                aria-expanded={isExpanded}
                aria-controls={subMenuId}
                className={`group relative flex w-full min-h-10 items-center justify-between rounded-lg px-1.5 py-1 text-[13px] font-medium leading-normal transition-colors duration-150 ${sectionActive
                    ? 'text-[#C7A759]'
                    : 'text-white'
                  }`}
              >
                {sectionActive ? (
                  <span
                    className="pointer-events-none absolute left-1 md:-left-[26px] top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full md:rounded-r-full bg-[#C7A759]"
                    aria-hidden="true"
                  />
                ) : (
                  <span
                    className="pointer-events-none absolute left-1 md:-left-[26px] top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full md:rounded-r-full bg-white opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                    aria-hidden="true"
                  />
                )}
                <span className="flex min-w-0 items-center gap-3.5">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] transition-colors duration-150 ${sectionActive
                        ? 'bg-[#383A40]'
                        : 'bg-transparent group-hover:bg-white/[0.06]'
                      }`}
                  >
                    <Icon
                      className={`h-[17px] w-[17px] shrink-0 transition-colors duration-150 ${sectionActive
                          ? 'text-[#C7A759]'
                          : 'text-[#B4B5C0] group-hover:text-white'
                        }`}
                      aria-hidden="true"
                    />
                  </span>
                  <span className="truncate">{section.label}</span>
                </span>
                <ChevronDown
                  className={`mr-1.5 h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${sectionActive
                      ? 'text-[#C7A759]'
                      : 'text-[#B4B5C0] group-hover:text-white'
                    } ${isExpanded ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>
            ) : (
              <Link
                href={resolveTenantHref(section.href, pathname)}
                onClick={onNavigate}
                aria-current={sectionActive ? 'page' : undefined}
                className={`group relative flex min-h-10 items-center gap-3.5 rounded-lg px-1.5 py-1 text-[13px] font-medium leading-normal transition-colors duration-150 ${sectionActive
                    ? 'text-[#C7A759]'
                    : 'text-white'
                  }`}
              >
                {sectionActive ? (
                  <span
                    className="pointer-events-none absolute left-1 md:-left-[26px] top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full md:rounded-r-full bg-[#C7A759]"
                    aria-hidden="true"
                  />
                ) : (
                  <span
                    className="pointer-events-none absolute left-1 md:-left-[26px] top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full md:rounded-r-full bg-white opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                    aria-hidden="true"
                  />
                )}
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] transition-colors duration-150 ${sectionActive
                      ? 'bg-[#383A40]'
                      : 'bg-transparent group-hover:bg-white/[0.06]'
                    }`}
                >
                  <Icon
                    className={`h-[17px] w-[17px] shrink-0 transition-colors duration-150 ${sectionActive
                        ? 'text-[#C7A759]'
                        : 'text-[#B4B5C0] group-hover:text-white'
                      }`}
                    aria-hidden="true"
                  />
                </span>
                <span className="truncate">{section.label}</span>
              </Link>
            )}

            {hasChildren && isExpanded ? (
              <div
                id={subMenuId}
                role="region"
                aria-label={`${section.label} sub-navigation`}
                className="ml-5 mt-1 space-y-0.5 border-l border-white/10 pl-2.5"
              >
                {section.children!.map((child) => {
                  const childActive = isChildRouteActive(
                    child.href,
                    pathname,
                    section.children!.map((c) => c.href)
                  );
                  return (
                    <Link
                      key={child.href}
                      href={resolveTenantHref(child.href, pathname)}
                      onClick={onNavigate}
                      aria-current={childActive ? 'page' : undefined}
                      className={`group relative flex min-h-8 items-center rounded-lg px-3 py-1 text-[12.5px] leading-normal transition-colors duration-150 ${childActive
                          ? 'bg-[rgba(199,167,89,0.10)] font-medium text-[#C7A759] hover:bg-[rgba(199,167,89,0.14)]'
                          : 'font-normal text-[#A9AAB5] hover:bg-white/[0.06] hover:text-white'
                        }`}
                    >
                      <span className="truncate">{child.label}</span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}

      {orgSlug ? (
        <div className="pt-1">
          <div className="wp-sidebar-divider -ml-[2px] mr-3 my-3" aria-hidden="true" />
          <Link
            href={`/careers/${orgSlug}`}
            target="_blank"
            onClick={onNavigate}
            className="group relative flex min-h-10 items-center gap-3.5 rounded-lg px-1.5 py-1 text-[13px] font-medium leading-normal text-white transition-colors duration-150"
          >
            <span
              className="pointer-events-none absolute left-1 md:-left-[26px] top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full md:rounded-r-full bg-white opacity-0 group-hover:opacity-100 transition-opacity duration-150"
              aria-hidden="true"
            />
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-transparent group-hover:bg-white/[0.06] transition-colors duration-150">
              <Building2
                className="h-[17px] w-[17px] shrink-0 text-[#B4B5C0] group-hover:text-white transition-colors duration-150"
                aria-hidden="true"
              />
            </span>
            <span className="truncate">Public Career Site</span>
            <ExternalLink
              className="ml-auto mr-1.5 h-3.5 w-3.5 shrink-0 text-[#B4B5C0] group-hover:text-white transition-colors duration-150"
              aria-hidden="true"
            />
          </Link>
        </div>
      ) : null}
    </nav>
  );
}
