const KNOWN_TOP_LEVEL_ROUTES = new Set([
  'dashboard',
  'employee',
  'careers',
  'login',
  'api',
  'tenant-entry',
  'features',
  'security',
  'workspace-discovery',
  'activate',
  'request-demo',
]);

/**
 * Extracts a tenant prefix (e.g. "/saga") from a pathname if present.
 * In temporary single-host deployments (e.g. Vercel), path-based tenancy uses `/:tenantSlug/dashboard/...`.
 * On custom domains or subdomains, paths do not contain a tenant slug prefix, so this returns "".
 */
export function getTenantPrefix(pathname: string): string {
  if (!pathname) return '';
  const shared = pathname.match(/^\/w\/([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?=\/(?:dashboard|employee|careers|login|api|tenant-entry)(?:\/|$))/);
  if (shared) return `/w/${shared[1]}`;
  const match = pathname.match(/^\/([a-zA-Z0-9_-]+)(?=\/(?:dashboard|employee|careers|login|api|tenant-entry)(?:\/|$))/);
  if (match) {
    const candidate = match[1].toLowerCase();
    if (KNOWN_TOP_LEVEL_ROUTES.has(candidate)) {
      return '';
    }
    return `/${candidate}`;
  }
  return '';
}

/**
 * Normalizes any route (e.g. "/saga/dashboard/leave" or "/dashboard/leave") to its
 * canonical internal logical route (e.g. "/dashboard/leave").
 */
export function stripTenantPrefix(pathname: string): string {
  if (!pathname) return '';
  const prefix = getTenantPrefix(pathname);
  if (prefix && pathname.startsWith(prefix)) {
    const stripped = pathname.slice(prefix.length);
    return stripped.startsWith('/') ? stripped : `/${stripped}`;
  }
  return pathname;
}

/**
 * Given a canonical internal href (e.g. "/dashboard/leave") and current pathname
 * (e.g. "/saga/dashboard/..."), preserves the tenant prefix for client-side navigation.
 */
export function resolveTenantHref(href: string, currentPathname: string): string {
  if (!href) return '';
  const prefix = getTenantPrefix(currentPathname);
  if (!prefix) return href;
  if (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('#') ||
    href.startsWith(prefix)
  ) {
    return href;
  }
  if (href.startsWith('/dashboard') || href.startsWith('/employee') || href.startsWith('/careers')) {
    return `${prefix}${href}`;
  }
  return href;
}

/**
 * Checks whether a target canonical href is active relative to current pathname.
 */
export function isRouteActive(targetHref: string, currentPathname: string, exact: boolean = false): boolean {
  const normTarget = stripTenantPrefix(targetHref).replace(/\/$/, '') || '/';
  const normCurrent = stripTenantPrefix(currentPathname).replace(/\/$/, '') || '/';

  if (exact || normTarget === '/dashboard' || normTarget === '/employee') {
    return normCurrent === normTarget;
  }
  return normCurrent === normTarget || normCurrent.startsWith(`${normTarget}/`);
}

/**
 * Checks whether a section is active given its href or sectionPrefix.
 */
export function isSectionActive(sectionHref: string, currentPathname: string, sectionPrefix?: string): boolean {
  const normCurrent = stripTenantPrefix(currentPathname).replace(/\/$/, '') || '/';
  if (sectionPrefix) {
    const normPrefix = stripTenantPrefix(sectionPrefix).replace(/\/$/, '') || '/';
    return normCurrent === normPrefix || normCurrent.startsWith(`${normPrefix}/`);
  }
  const normSection = stripTenantPrefix(sectionHref).replace(/\/$/, '') || '/';
  if (normSection === '/dashboard' || normSection === '/employee') {
    return normCurrent === normSection;
  }
  return normCurrent === normSection || normCurrent.startsWith(`${normSection}/`);
}

/**
 * Accurately determines if a child link is active among sibling options,
 * preventing shorter paths (e.g. /dashboard/leave) from stealing active state from /dashboard/leave/balances.
 */
export function isChildRouteActive(childHref: string, currentPathname: string, allSiblingHrefs: string[] = []): boolean {
  const normChild = stripTenantPrefix(childHref).replace(/\/$/, '') || '/';
  const normCurrent = stripTenantPrefix(currentPathname).replace(/\/$/, '') || '/';

  if (normCurrent === normChild) return true;

  if (normCurrent.startsWith(`${normChild}/`)) {
    const moreSpecificSibling = allSiblingHrefs.some((sibling) => {
      const normSibling = stripTenantPrefix(sibling).replace(/\/$/, '') || '/';
      return (
        normSibling !== normChild &&
        normSibling.startsWith(normChild) &&
        (normCurrent === normSibling || normCurrent.startsWith(`${normSibling}/`))
      );
    });
    return !moreSpecificSibling;
  }

  return false;
}
