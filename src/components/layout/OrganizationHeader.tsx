import type { OrganizationBrandingView } from '@/features/organization-branding/read-model';
import { TenantLogo } from './TenantLogo';

export function OrganizationHeader({ branding }: { branding: OrganizationBrandingView }) {
  return (
    <div className="border-b border-[#E8E2D6] bg-gradient-to-b from-white to-[#FAF8F2] px-6 py-10 text-[#111111] sm:px-12 sm:py-14">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-2xl p-1 bg-gradient-to-br from-[#D9A928] to-[#F1D36A] shadow-md sm:h-28 sm:w-28">
          <TenantLogo
            branding={branding}
            size={104}
            className="h-full w-full rounded-xl object-cover bg-white"
            fallbackClassName="flex h-full w-full items-center justify-center rounded-xl bg-[#111111] text-xl font-bold text-white"
          />
        </div>
        <p className="mt-5 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#9A7415]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#D9A928]" />
          Official Career Portal
        </p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#111111] sm:text-4xl">{branding.displayName}</h1>
        {branding.tagline && <p className="mt-3 max-w-2xl text-xs leading-relaxed text-[#6B6B6B] sm:text-sm">{branding.tagline}</p>}
      </div>
    </div>
  );
}
