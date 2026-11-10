'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRound } from 'lucide-react';
import { isRouteActive, resolveTenantHref } from '@/lib/tenant/navigation';

/** Bottom-of-sidebar account navigation, outside the scrolling feature list. */
export function DashboardProfileLink({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const href = '/dashboard/profile';
  const active = isRouteActive(href, pathname);
  return (
    <Link
      href={resolveTenantHref(href, pathname)}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`group flex min-h-10 items-center gap-3.5 rounded-lg px-1.5 py-1 text-[13px] font-medium leading-normal transition-colors ${active ? 'text-[#C7A759]' : 'text-white hover:text-[#C7A759]'}`}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-[#383A40]' : 'group-hover:bg-white/[0.06]'}`}>
        <UserRound aria-hidden="true" className={`h-[17px] w-[17px] ${active ? 'text-[#C7A759]' : 'text-[#B4B5C0] group-hover:text-white'}`}/>
      </span>
      <span>My Profile</span>
    </Link>
  );
}
