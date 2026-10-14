'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isRouteActive, resolveTenantHref } from '@/lib/tenant/navigation';

export const hiringRoutes = [
  ['pipeline', 'Pipeline'], ['jobs', 'Job openings'], ['applicants', 'Applicants'],
  ['interviews', 'Interviews'], ['assessments', 'Assessments'], ['offers', 'Offers'], ['onboarding', 'Onboarding'],
] as const;

export function HiringWorkspaceNav() {
  const pathname = usePathname();
  return <nav aria-label="Hiring workspace" className="wp-workspace-nav">
    {hiringRoutes.map(([route, label]) => {
      const href = `/dashboard/hiring/${route}`;
      const active = isRouteActive(href, pathname);
      return <Link key={route} href={resolveTenantHref(href, pathname)} aria-current={active ? 'page' : undefined}>{label}</Link>;
    })}
  </nav>;
}

export function SectionNav({ items, label }: { items: Array<{ id: string; label: string }>; label: string }) {
  return <nav aria-label={label} className="wp-section-nav">{items.map(item =>
    <a key={item.id} href={`#${item.id}`}>{item.label}</a>
  )}</nav>;
}
