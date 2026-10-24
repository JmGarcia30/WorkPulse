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
  return normalizeAuthority(value)?.split(':')[0] ?? '';
}

// A single DNS authority, never a URL, forwarded list, userinfo or encoded host.
export function normalizeAuthority(value: string): string | null {
  if (!value || value !== value.trim() || /[\s,/@\\?#%]/.test(value)) return null;
  const match = /^([a-z0-9.-]+)(?::([0-9]{1,5}))?$/i.exec(value);
  if (!match || match[1].length > 253 || match[1].toLowerCase().split('.').some(label => !LABEL.test(label))) return null;
  if (match[2] && (Number(match[2]) < 1 || Number(match[2]) > 65535 || String(Number(match[2])) !== match[2])) return null;
  return match[1].toLowerCase() + (match[2] ? ':' + match[2] : '');
}

export function requestAuthority(requestHeaders: Pick<Headers, 'get'>): string | null {
  const host = normalizeAuthority(requestHeaders.get('host') ?? '');
  const forwarded = requestHeaders.get('x-forwarded-host');
  // Infrastructure must preserve Host. A forwarded header can agree, never
  // select a different tenant or rescue a missing/unrecognized actual Host.
  if (!host || (forwarded !== null && normalizeAuthority(forwarded) !== host)) return null;
  return host;
}

export function classifyRequestHost(requestHeaders: Pick<Headers, 'get'>): PlatformHost {
  const authority = requestAuthority(requestHeaders);
  const configured = process.env.PLATFORM_ROOT_DOMAIN || (process.env.NODE_ENV === 'production' ? '' : rootDomain());
  return authority ? parsePlatformHost(authority, configured) : { kind: 'invalid', hostname: '' };
}

export function parsePlatformHost(value: string, configuredRoot = rootDomain()): PlatformHost {
  const hostname = normalizeHostname(value);
  const root = normalizeHostname(configuredRoot);
  const authority = normalizeAuthority(value), rootAuthority = normalizeAuthority(configuredRoot);
  if (!hostname || !root || !authority || !rootAuthority || authority.split(':')[1] !== rootAuthority.split(':')[1]) return { kind: 'invalid', hostname };
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
