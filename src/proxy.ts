import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { parsePlatformHost, rootDomain } from '@/lib/tenant/host';

const sessionCookieNames = ['__Host-workpulse_session', 'workpulse_session'];

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const classification = parsePlatformHost(request.headers.get('x-forwarded-host') || request.headers.get('host') || '');
  const hasSession = sessionCookieNames.some((name) => Boolean(request.cookies.get(name)?.value));

  if (classification.kind === 'invalid') return new NextResponse('Workspace host not found.', { status: 404 });

  if (classification.kind === 'public' && (pathname.startsWith('/dashboard') || pathname.startsWith('/employee') || pathname === '/login')) {
    return NextResponse.redirect(new URL(`${request.nextUrl.protocol}//app.${rootDomain()}`));
  }

  if (classification.kind === 'public' && pathname === '/workspace-discovery') {
    return NextResponse.redirect(new URL(`${request.nextUrl.protocol}//app.${rootDomain()}`));
  }

  if (classification.kind === 'discovery') {
    if (pathname === '/' || pathname === '/login') {
      const url = request.nextUrl.clone(); url.pathname = '/workspace-discovery';
      return NextResponse.rewrite(url);
    }
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/employee')) {
      const url = request.nextUrl.clone(); url.pathname = '/';
      return NextResponse.redirect(url);
    }
  }

  if (classification.kind === 'tenant') {
    if (pathname === '/') {
      const url = request.nextUrl.clone(); url.pathname = '/_tenant';
      return NextResponse.rewrite(url);
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
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
