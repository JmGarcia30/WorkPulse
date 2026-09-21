import { notFound, redirect } from 'next/navigation';
import { TenantLoginForm } from '@/components/auth/TenantLoginForm';
import { TenantTheme } from '@/components/layout/TenantTheme';
import { resolveRequestTenant } from '@/lib/tenant/server';
import { getSession } from '@/lib/auth/session';
import { landingPathForRole } from '@/lib/auth/routing';

export default async function LoginPage() {
  const tenant = await resolveRequestTenant();
  if (!tenant) notFound();
  const session = await getSession();
  if (session?.organizationId === tenant.organizationId) redirect(landingPathForRole(session.role));
  const logo = tenant.hasLogo ? `/api/branding/logo?v=${encodeURIComponent(tenant.updatedAt)}` : null;
  const loginImage = tenant.hasLoginImage ? `/api/branding/login-image?v=${encodeURIComponent(tenant.updatedAt)}` : null;
  return <TenantTheme branding={tenant} className="min-h-screen bg-[var(--wp-background)]"><main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(28rem,42%)]"><section className="hidden border-r border-[var(--wp-border)] bg-[var(--tenant-primary)] lg:flex lg:flex-col lg:justify-between lg:p-12" style={loginImage ? { backgroundImage: `linear-gradient(90deg, color-mix(in srgb, var(--tenant-primary) 88%, transparent), color-mix(in srgb, var(--tenant-primary) 68%, transparent)), url(${loginImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}><p className="text-sm font-bold tracking-wide text-[var(--tenant-primary-foreground)]">{tenant.displayName}</p><div className="max-w-xl text-[var(--tenant-primary-foreground)]"><p className="text-sm font-semibold uppercase tracking-[0.16em] opacity-75">Organization workspace</p><h1 className="mt-4 text-5xl font-semibold leading-tight">People operations, from hiring through active employment.</h1>{tenant.tagline && <p className="mt-5 max-w-lg text-lg leading-7 opacity-80">{tenant.tagline}</p>}</div><p className="text-sm text-[var(--tenant-primary-foreground)] opacity-70">Powered by WorkPulse</p></section><section className="flex items-center justify-center px-5 py-12 sm:px-10"><div className="w-full max-w-sm">{logo ? <img src={logo} alt={`${tenant.displayName} logo`} className="mb-8 h-16 max-w-48 object-contain object-left" /> : <div className="mb-8 flex h-14 w-14 items-center justify-center bg-[var(--tenant-primary)] text-lg font-bold text-[var(--tenant-primary-foreground)]">{tenant.displayName.slice(0, 2).toUpperCase()}</div>}<p className="wp-eyebrow">Secure workspace</p><h2 className="wp-page-title mt-2">Sign in to {tenant.displayName}</h2><p className="mt-2 text-sm text-[var(--wp-text-muted)]">Use the account issued by your organization.</p><TenantLoginForm /><p className="mt-8 border-t border-[var(--wp-border)] pt-5 text-xs text-[var(--wp-text-muted)]">Protected by WorkPulse tenant isolation. <a href="/careers" className="font-semibold text-[var(--wp-text)] hover:underline">View careers</a></p></div></section></main></TenantTheme>;
}
