import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { classifyRequestHost, databaseSlugForTenant, discoveryOrigin, normalizeHostname, publicOrigin, requestAuthority, rootDomain, usesTemporaryPathTenancy } from '@/lib/tenant/host';
import { prisma } from '@/lib/db/prisma';
import { ROUTING_CONTEXT_HEADER, signRoutingContext } from '@/lib/tenant/routing-context';

const sessionCookieNames = ['__Host-workpulse_session', 'workpulse_session'];
const pathTenantCookie = 'workpulse_path_tenant';

type RoutedOrganization = { id: string; slug: string };
function cleanRequestHeaders(request: NextRequest, organization?: RoutedOrganization | null, mode: 'subdomain' | 'saga-path' = 'subdomain') {
  const headers = new Headers(request.headers);
  headers.delete('x-workpulse-tenant-slug');
  headers.delete(ROUTING_CONTEXT_HEADER);
  headers.delete('forwarded');
  const authority = requestAuthority(request.headers)!;
  headers.set('host', authority);
  headers.set('x-forwarded-host', authority);
  if (organization) headers.set(ROUTING_CONTEXT_HEADER, signRoutingContext({ organizationId: organization.id, slug: organization.slug, host: authority, mode }));
  return headers;
}

function requestUrl(request: NextRequest) {
  const url = new URL(request.url);
  url.host = requestAuthority(request.headers)!;
  url.protocol = normalizeHostname(rootDomain()) === 'localhost' ? 'http:' : 'https:';
  return url;
}

function pathTenantResponse(request: NextRequest, internalPathname: string, tenantSlug: string, organization: RoutedOrganization | null) {
  if (!organization) return new NextResponse('Workspace not found.', { status: 404 });
  // Keep Next's internal origin for rewrites. Changing it to the public Host
  // can turn a local rewrite into an external request and discard its context.
  const url = request.nextUrl.clone();
  url.pathname = internalPathname;
  const requestHeaders = cleanRequestHeaders(request, organization, 'saga-path');
  requestHeaders.set('x-workpulse-tenant-slug', tenantSlug);
  const response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  response.cookies.set(pathTenantCookie, tenantSlug, {
    httpOnly: true,
    secure: normalizeHostname(rootDomain()) !== 'localhost',
    sameSite: 'lax',
    path: '/',
  });
  return response;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const classification = classifyRequestHost(request.headers);
  if (classification.kind === 'invalid') return new NextResponse('Workspace host not found.', { status: 404 });
  const hasSession = sessionCookieNames.some((name) => Boolean(request.cookies.get(name)?.value));
  const host = requestAuthority(request.headers)!;
  if (pathname === '/api/email-integration/google/start' || pathname === '/api/email-integration/google/callback') {
    let canonical: string;
    try { canonical = new URL(publicOrigin()).host; } catch { return new NextResponse('Email integration unavailable.', { status: 503 }); }
    if (classification.kind !== 'public' || host !== canonical) return new NextResponse('Not found.', { status: 404 });
    return NextResponse.next({ request: { headers: cleanRequestHeaders(request) } });
  }
  const usesPathTenancy = classification.kind === 'public' && (usesTemporaryPathTenancy(host) || pathname === '/saga' || pathname.startsWith('/saga/') || request.cookies.get(pathTenantCookie)?.value === 'saga');

  // Platform routes never participate in tenant/path rewrites or tenant cookies.
  if (pathname === '/platform' || pathname.startsWith('/platform/') || pathname === '/register' || pathname.startsWith('/register/')) {
    if (classification.kind !== 'public') return new NextResponse('Not found.', { status: 404 });
    if (pathname === '/register' || pathname.startsWith('/register/')) {
      let canonical: URL;
      try { canonical = new URL(publicOrigin()); } catch { return new NextResponse('Registration unavailable.', { status: 503 }); }
      if (host !== canonical.host) {
        if (request.method !== 'GET' && request.method !== 'HEAD') return new NextResponse('Not found.', { status: 404 });
        canonical.pathname = pathname; canonical.search = request.nextUrl.search;
        return NextResponse.redirect(canonical);
      }
    }
    return NextResponse.next({ request: { headers: cleanRequestHeaders(request) } });
  }

  // A syntactically valid wildcard hostname is only a routing candidate. Every
  // tenant request must also map to a persisted organization before any route.
  const needsSaga = usesPathTenancy && (pathname === '/saga' || pathname.startsWith('/saga/') || request.cookies.get(pathTenantCookie)?.value === 'saga');
  const slug = classification.kind === 'tenant' ? databaseSlugForTenant(classification.slug) : needsSaga ? 'st-aloysius' : null;
  const organization = slug ? await prisma.organization.findUnique({ where: { slug }, select: { id: true, slug: true } }) : null;
  if (slug && !organization) return new NextResponse('Workspace not found.', { status: 404 });
  const tenantOrganization = classification.kind === 'tenant' ? organization : null;
  if (tenantOrganization && pathname.startsWith('/careers/') && databaseSlugForTenant(pathname.split('/')[2]) !== tenantOrganization.slug) {
    return new NextResponse('Workspace route not found.', { status: 404 });
  }

  if (pathname === '/careers/saga' || pathname === '/careers/st-aloysius' || pathname === '/careers/saga/' || pathname === '/careers/st-aloysius/') {
    if (classification.kind === 'tenant') {
      return NextResponse.redirect(new URL('/#careers', requestUrl(request)));
    }
    return NextResponse.redirect(new URL('/saga#careers', requestUrl(request)));
  }

  if (pathname.startsWith('/careers/st-aloysius/')) {
    const jobSuffix = pathname.slice('/careers/st-aloysius'.length);
    const url = requestUrl(request);
    if (classification.kind === 'tenant') {
      url.pathname = `/careers/${classification.slug}${jobSuffix}`;
    } else {
      url.pathname = `/saga/careers${jobSuffix}`;
    }
    if (url.pathname !== pathname) return NextResponse.redirect(url);
  }

  if (usesPathTenancy) {
    const pathMatch = pathname.match(/^\/saga(?:\/|$)/);
    if (pathMatch) {
      const suffix = pathname.slice('/saga'.length) || '/';
      if (suffix === '/') return pathTenantResponse(request, '/tenant-entry', 'saga', organization);
      if (suffix === '/login') return pathTenantResponse(request, '/login', 'saga', organization);
      // Kiosk authentication is independent of the HR session cookie.
      if (suffix === '/attendance-kiosk' || suffix.startsWith('/api/attendance/rfid/')) {
        return pathTenantResponse(request, suffix, 'saga', organization);
      }
      if (suffix === '/careers' || suffix === '/careers/') {
        return NextResponse.redirect(new URL('/saga#careers', requestUrl(request)));
      }
      if (suffix.startsWith('/careers/')) {
        return pathTenantResponse(request, `/careers/saga${suffix.slice('/careers'.length)}`, 'saga', organization);
      }
      if (suffix.startsWith('/dashboard') || suffix.startsWith('/employee')) {
        if (!hasSession) {
          const login = requestUrl(request);
          login.pathname = '/saga/login';
          login.searchParams.set('callbackUrl', `/saga${suffix}`);
          return NextResponse.redirect(login);
        }
        return pathTenantResponse(request, suffix, 'saga', organization);
      }
    }

    const rememberedTenant = request.cookies.get(pathTenantCookie)?.value === 'saga' ? 'saga' : null;
    if (rememberedTenant) {
      if (pathname === '/attendance-kiosk') return pathTenantResponse(request, pathname, rememberedTenant, organization);
      if (pathname === '/login') {
        const url = requestUrl(request); url.pathname = '/saga/login';
        return NextResponse.redirect(url);
      }
      if (pathname === '/careers' || pathname === '/careers/saga' || pathname === '/careers/st-aloysius') {
        return NextResponse.redirect(new URL('/saga#careers', requestUrl(request)));
      }
      if (pathname.startsWith('/careers/')) {
        const jobSuffix = pathname.replace(/^\/careers\/(?:saga\/|st-aloysius\/)?/, '');
        const url = requestUrl(request);
        url.pathname = `/saga/careers/${jobSuffix}`;
        return NextResponse.redirect(url);
      }
      if (pathname.startsWith('/dashboard') || pathname.startsWith('/employee')) {
        const url = requestUrl(request); url.pathname = `/saga${pathname}`;
        return NextResponse.redirect(url);
      }
      if (pathname.startsWith('/api/')) return pathTenantResponse(request, pathname, rememberedTenant, organization);
    }
  }

  if (classification.kind === 'public' && (pathname.startsWith('/dashboard') || pathname.startsWith('/employee') || pathname === '/login')) {
    return NextResponse.redirect(new URL(discoveryOrigin(), requestUrl(request)));
  }

  if (classification.kind === 'public' && pathname === '/workspace-discovery' && !usesPathTenancy) {
    return NextResponse.redirect(new URL(discoveryOrigin(), requestUrl(request)));
  }

  if (classification.kind === 'discovery') {
    if (pathname === '/' || pathname === '/login') {
      const url = request.nextUrl.clone(); url.pathname = '/workspace-discovery';
      return NextResponse.rewrite(url, { request: { headers: cleanRequestHeaders(request) } });
    }
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/employee')) {
      const url = requestUrl(request); url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  if (classification.kind === 'tenant') {
    if (pathname === '/') {
      const url = request.nextUrl.clone(); url.pathname = '/tenant-entry';
      return NextResponse.rewrite(url, { request: { headers: cleanRequestHeaders(request, tenantOrganization) } });
    }
    if ((pathname.startsWith('/dashboard') || pathname.startsWith('/employee')) && !hasSession) {
      const login = new URL('/login', requestUrl(request));
      login.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(login);
    }
    if (pathname === '/careers' || pathname === '/careers/') {
      return NextResponse.redirect(new URL('/#careers', requestUrl(request)));
    }
  }

  return NextResponse.next({ request: { headers: cleanRequestHeaders(request, tenantOrganization) } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
