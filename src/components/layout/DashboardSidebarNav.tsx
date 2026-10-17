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
      { href: '/dashboard/organization', label: 'Organization Settings', icon: Settings },
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
    <nav aria-label="Main navigation" className="space-y-1 p-3">
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
                className={`flex w-full min-h-11 items-center justify-between rounded-md px-3 text-sm font-semibold transition ${
                  sectionActive
                    ? 'border-l-2 border-[var(--tenant-primary)] bg-[var(--tenant-tint)] text-[var(--tenant-primary)]'
                    : 'text-[var(--wp-text-muted)] hover:bg-[var(--tenant-tint-strong)] hover:text-[var(--wp-text)]'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{section.label}</span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform duration-200 ${
                    isExpanded ? 'rotate-180 text-[var(--tenant-primary)]' : 'text-[var(--wp-text-muted)]'
                  }`}
                  aria-hidden="true"
                />
              </button>
            ) : (
              <Link
                href={resolveTenantHref(section.href, pathname)}
                onClick={onNavigate}
                aria-current={sectionActive ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold transition ${
                  sectionActive
                    ? 'border-l-2 border-[var(--tenant-primary)] bg-[var(--tenant-tint)] text-[var(--tenant-primary)]'
                    : 'text-[var(--wp-text-muted)] hover:bg-[var(--tenant-tint-strong)] hover:text-[var(--wp-text)]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{section.label}</span>
              </Link>
            )}

            {hasChildren && isExpanded ? (
              <div
                id={subMenuId}
                role="region"
                aria-label={`${section.label} sub-navigation`}
                className="ml-5 mt-1 space-y-0.5 border-l border-[var(--tenant-border)] pl-3"
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
                      className={`block rounded-md px-3 py-2 text-sm font-semibold transition ${
                        childActive
                          ? 'bg-[var(--tenant-tint-strong)] font-bold text-[var(--tenant-primary)]'
                          : 'text-[var(--wp-text-muted)] hover:bg-[var(--tenant-tint)] hover:text-[var(--wp-text)]'
                      }`}
                    >
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}

      {orgSlug ? (
        <div className="mt-3 border-t border-[var(--tenant-border)] pt-3">
          <Link
            href={`/careers/${orgSlug}`}
            target="_blank"
            onClick={onNavigate}
            className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-semibold text-[var(--wp-text-muted)] hover:bg-[var(--tenant-tint)] hover:text-[var(--wp-text)]"
          >
            <Building2 className="h-4 w-4" aria-hidden="true" />
            <span>Public Career Site</span>
            <ExternalLink className="ml-auto h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      ) : null}
    </nav>
  );
}
