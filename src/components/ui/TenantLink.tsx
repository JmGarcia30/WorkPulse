'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { resolveTenantHref } from '@/lib/tenant/navigation';

export interface TenantLinkProps extends React.ComponentProps<typeof Link> {
  href: string;
}

/**
 * TenantLink wraps Next.js Link and automatically preserves tenant path prefixes
 * (such as "/saga/dashboard/..." on Vercel temporary path tenancy or "/dashboard/..." on localhost).
 */
export function TenantLink({ href, children, ...props }: TenantLinkProps) {
  const pathname = usePathname();
  const resolvedHref = resolveTenantHref(href, pathname);
  return (
    <Link href={resolvedHref} {...props}>
      {children}
    </Link>
  );
}
