export type PlatformHost =
  | { kind: 'public'; hostname: string }
  | { kind: 'discovery'; hostname: string }
  | { kind: 'tenant'; hostname: string; slug: string }
  | { kind: 'invalid'; hostname: string };

export const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'admin', 'assets', 'static']);
const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function rootDomain() {
  return (process.env.PLATFORM_ROOT_DOMAIN || 'localhost:3000').toLowerCase();
}

export function normalizeHostname(value: string) {
  return value.trim().toLowerCase().split(',')[0].trim().replace(/:\d+$/, '').replace(/\.$/, '');
}

export function parsePlatformHost(value: string, configuredRoot = rootDomain()): PlatformHost {
  const hostname = normalizeHostname(value);
  const root = normalizeHostname(configuredRoot);
  if (!hostname || !root) return { kind: 'invalid', hostname };
  if (hostname === root || hostname === `www.${root}`) return { kind: 'public', hostname };
  if (hostname === `app.${root}`) return { kind: 'discovery', hostname };
  if (!hostname.endsWith(`.${root}`)) return { kind: 'invalid', hostname };
  const slug = hostname.slice(0, -(root.length + 1));
  if (!LABEL.test(slug) || slug.includes('.') || RESERVED_SUBDOMAINS.has(slug)) return { kind: 'invalid', hostname };
  return { kind: 'tenant', hostname, slug };
}

export function tenantOrigin(slug: string) {
  if (usesTemporaryPathTenancy(rootDomain())) return `/${slug}`;
  const root = rootDomain();
  const protocol = root.startsWith('localhost') || root.startsWith('127.0.0.1') ? 'http' : 'https';
  return `${protocol}://${slug}.${root}`;
}

export function databaseSlugForTenant(slug: string) {
  return slug === 'saga' ? 'st-aloysius' : slug;
}

export function publicOrigin() {
  return process.env.PLATFORM_PUBLIC_ORIGIN || 'http://localhost:3000';
}

export function usesTemporaryPathTenancy(host: string) {
  try {
    const publicHost = normalizeHostname(new URL(publicOrigin()).host);
    return publicHost.endsWith('.vercel.app') && normalizeHostname(host) === publicHost;
  } catch {
    return false;
  }
}

export function discoveryOrigin() {
  if (usesTemporaryPathTenancy(rootDomain())) return '/workspace-discovery';
  const root = rootDomain();
  const protocol = root.startsWith('localhost') || root.startsWith('127.0.0.1') ? 'http' : 'https';
  return `${protocol}://app.${root}`;
}
