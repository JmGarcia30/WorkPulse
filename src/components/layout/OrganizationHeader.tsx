import type { OrganizationBrandingView } from '@/features/organization-branding/read-model';
import { TenantLogo } from './TenantLogo';

export function OrganizationHeader({ branding }: { branding: OrganizationBrandingView }) {
  return (
    <div className="border-t-4 border-[var(--tenant-accent)] bg-[var(--tenant-primary)] px-6 py-10 text-[var(--tenant-primary-foreground)] sm:px-12 sm:py-12">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-white p-2 shadow-sm sm:h-32 sm:w-32">
          <TenantLogo branding={branding} size={112} className="h-full w-full object-contain" fallbackClassName="flex h-full w-full items-center justify-center rounded-xl bg-[var(--tenant-accent)] text-xl font-black text-[var(--tenant-accent-foreground)]" />
        </div>
        <p className="mt-6 border-l-2 border-[var(--tenant-accent)] pl-3 text-xs font-semibold uppercase tracking-[.14em] opacity-85">Official organization career portal</p>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight sm:text-4xl">{branding.displayName}</h1>
        {branding.tagline && <p className="mt-4 max-w-2xl text-xs leading-relaxed opacity-78 sm:text-sm">{branding.tagline}</p>}
      </div>
    </div>
  );
}
