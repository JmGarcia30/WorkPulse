'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, LayoutDashboard, ScrollText, UserRound, Plus } from 'lucide-react';

const items = [
  { href: '/platform', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/platform/organizations', label: 'Organizations', icon: Building2 },
  { href: '/platform/audit-logs', label: 'Audit Logs', icon: ScrollText },
  { href: '/platform/settings', label: 'My Account', icon: UserRound },
];

export function PlatformNavigation() {
  const pathname = usePathname();
  return <nav className="platform-navigation" aria-label="Platform administration">
    <p className="platform-navigation-heading">WORKSPACE</p>
    {items.map(({ href, label, icon: Icon, exact }) => {
      const selected = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');
      return <Link key={href} href={href} aria-current={selected ? 'page' : undefined}
        className={'platform-navigation-link' + (selected ? ' platform-navigation-link-active' : '')}>
        <Icon size={18} strokeWidth={1.9} aria-hidden="true"/>
        <span>{label}</span>
      </Link>;
    })}
    <Link href="/platform/organizations/new" className="platform-navigation-create">
      <Plus size={17} aria-hidden="true"/> Add organization
    </Link>
  </nav>;
}
