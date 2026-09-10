'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Sparkles } from 'lucide-react';

interface DashboardHeaderProps {
  orgName: string;
}

export function DashboardHeader({ orgName }: DashboardHeaderProps) {
  const pathname = usePathname();

  // Generate breadcrumb items
  const generateBreadcrumbs = () => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0 || (segments.length === 1 && segments[0] === 'dashboard')) {
      return [{ label: 'Overview', href: '/dashboard', isLast: true }];
    }

    const items = [{ label: 'Dashboard', href: '/dashboard', isLast: false }];
    let currentPath = '';

    const labelMap: Record<string, string> = {
      hiring: 'Hiring',
      pipeline: 'ATS Pipeline',
      jobs: 'Job Postings',
      applicants: 'Applicants',
      interviews: 'Interviews',
      assessments: 'Assessments',
      offers: 'Job Offers',
      onboarding: 'Onboarding',
      employees: 'Employees',
      attendance: 'Attendance',
      schedules: 'Schedules',
      new: 'Create',
      edit: 'Edit',
    };

    segments.forEach((segment, idx) => {
      if (segment === 'dashboard') return;
      currentPath += `/${segment}`;

      const isLast = idx === segments.length - 1;
      const label = labelMap[segment] || (segment.length > 15 ? `${segment.slice(0, 8)}...` : segment);

      items.push({
        label,
        href: `/dashboard${currentPath}`,
        isLast,
      });
    });

    return items;
  };

  const breadcrumbs = generateBreadcrumbs();

  return (
    <header className="h-16 border-b border-[#E8EAED] bg-white/95 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
      {/* Breadcrumbs Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
        {breadcrumbs.map((crumb, idx) => (
          <React.Fragment key={crumb.href + idx}>
            {idx > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-[#9CA3AF] shrink-0" />
            )}
            {crumb.isLast ? (
              <span className="font-bold text-[#181A1C] truncate max-w-[200px]">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-[#6B7280] hover:text-[#181A1C] transition-colors truncate max-w-[150px] font-medium"
              >
                {crumb.label}
              </Link>
            )}
          </React.Fragment>
        ))}
      </nav>

      {/* Right Side Organization & Status Context */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full border border-[#E8EAED] bg-[#F8F9FA] text-[11px] font-semibold text-[#181A1C] shadow-2xs">
          <span className="h-2 w-2 rounded-full bg-[#22C55E] animate-pulse" />
          <span className="truncate max-w-[180px]">{orgName}</span>
          <span className="text-[#D1D5DB]">•</span>
          <span className="text-[10px] uppercase font-extrabold tracking-wider text-[#16A34A] flex items-center gap-1">
            <Sparkles className="h-2.5 w-2.5 text-[#F97316]" /> AI Active
          </span>
        </div>
      </div>
    </header>
  );
}
