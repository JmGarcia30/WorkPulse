import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { discoveryOrigin, parsePlatformHost, usesTemporaryPathTenancy } from '@/lib/tenant/host';

const sessionCookieNames = ['__Host-workpulse_session', 'workpulse_session'];
const pathTenantCookie = 'workpulse_path_tenant';

function cleanRequestHeaders(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete('x-workpulse-tenant-slug');
  return headers;
}

function pathTenantResponse(request: NextRequest, internalPathname: string, tenantSlug: string) {
  const url = request.nextUrl.clone();
  url.pathname = internalPathname;
  const requestHeaders = cleanRequestHeaders(request);
  requestHeaders.set('x-workpulse-tenant-slug', tenantSlug);
  const response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  response.cookies.set(pathTenantCookie, tenantSlug, {
    httpOnly: true,
    secure: request.nextUrl.protocol === 'https:',
    sameSite: 'lax',
    path: '/',
  });
  return response;
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const classification = parsePlatformHost(request.headers.get('x-forwarded-host') || request.headers.get('host') || '');
  const hasSession = sessionCookieNames.some((name) => Boolean(request.cookies.get(name)?.value));
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  const usesPathTenancy = classification.kind === 'public' && usesTemporaryPathTenancy(host);

  if (usesPathTenancy) {
    const pathMatch = pathname.match(/^\/saga(?:\/|$)/);
    if (pathMatch) {
      const suffix = pathname.slice('/saga'.length) || '/';
      if (suffix === '/') return pathTenantResponse(request, '/tenant-entry', 'saga');
      if (suffix === '/login') return pathTenantResponse(request, '/login', 'saga');
      if (suffix === '/careers' || suffix.startsWith('/careers/')) {
        return pathTenantResponse(request, `/careers/saga${suffix.slice('/careers'.length)}`, 'saga');
      }
      if (suffix.startsWith('/dashboard') || suffix.startsWith('/employee')) {
        if (!hasSession) {
          const login = request.nextUrl.clone();
          login.pathname = '/saga/login';
          login.searchParams.set('callbackUrl', `/saga${suffix}`);
          return NextResponse.redirect(login);
        }
        return pathTenantResponse(request, suffix, 'saga');
      }
    }

    const rememberedTenant = request.cookies.get(pathTenantCookie)?.value === 'saga' ? 'saga' : null;
    if (rememberedTenant) {
      if (pathname === '/login') {
        const url = request.nextUrl.clone(); url.pathname = '/saga/login';
        return NextResponse.redirect(url);
      }
      if (pathname === '/careers' || pathname === '/careers/saga' || pathname.startsWith('/careers/saga/')) {
        const url = request.nextUrl.clone();
        url.pathname = `/saga/careers${pathname.slice('/careers/saga'.length)}`;
        return NextResponse.redirect(url);
      }
      if (pathname.startsWith('/dashboard') || pathname.startsWith('/employee')) {
        const url = request.nextUrl.clone(); url.pathname = `/saga${pathname}`;
        return NextResponse.redirect(url);
      }
      if (pathname.startsWith('/api/')) return pathTenantResponse(request, pathname, rememberedTenant);
    }
  }

  if (classification.kind === 'invalid') return new NextResponse('Workspace host not found.', { status: 404 });

  if (classification.kind === 'public' && (pathname.startsWith('/dashboard') || pathname.startsWith('/employee') || pathname === '/login')) {
    return NextResponse.redirect(new URL(discoveryOrigin(), request.url));
  }

  if (classification.kind === 'public' && pathname === '/workspace-discovery' && !usesPathTenancy) {
    return NextResponse.redirect(new URL(discoveryOrigin(), request.url));
  }

  if (classification.kind === 'discovery') {
    if (pathname === '/' || pathname === '/login') {
      const url = request.nextUrl.clone(); url.pathname = '/workspace-discovery';
      return NextResponse.rewrite(url, { request: { headers: cleanRequestHeaders(request) } });
    }
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/employee')) {
      const url = request.nextUrl.clone(); url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  if (classification.kind === 'tenant') {
    if (pathname === '/') {
      const url = request.nextUrl.clone(); url.pathname = '/tenant-entry';
      return NextResponse.rewrite(url, { request: { headers: cleanRequestHeaders(request) } });
    }
    if ((pathname.startsWith('/dashboard') || pathname.startsWith('/employee')) && !hasSession) {
      const login = new URL('/login', request.url);
      login.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(login);
    }
    if ((pathname === '/careers' || pathname.startsWith('/careers/')) && !pathname.startsWith(`/careers/${classification.slug}`)) {
      const url = request.nextUrl.clone();
      const suffix = pathname.slice('/careers'.length);
      url.pathname = `/careers/${classification.slug}${suffix}`;
      return NextResponse.rewrite(url, { request: { headers: cleanRequestHeaders(request) } });
    }
  }

  return NextResponse.next({ request: { headers: cleanRequestHeaders(request) } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
