'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRound } from 'lucide-react';
import { isRouteActive, resolveTenantHref } from '@/lib/tenant/navigation';

export function DashboardProfileLink({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = isRouteActive('/dashboard/profile', pathname);
  return <Link
    href={resolveTenantHref('/dashboard/profile', pathname)}
    onClick={onNavigate}
    aria-current={active ? 'page' : undefined}
    className={`group flex min-h-10 items-center gap-3.5 rounded-lg px-1.5 py-1 text-[13px] font-medium transition-colors ${active ? 'text-[#C7A759]' : 'text-white hover:text-[#C7A759]'}`}
  >
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-[#383A40]' : 'group-hover:bg-white/[0.06]'}`}>
      <UserRound className={`h-[17px] w-[17px] ${active ? 'text-[#C7A759]' : 'text-[#B4B5C0] group-hover:text-white'}`} aria-hidden="true" />
    </span>
    <span>My Profile</span>
  </Link>;
}
