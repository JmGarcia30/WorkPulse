import Image from 'next/image';
import { Building2 } from 'lucide-react';

interface OrganizationHeaderProps {
  name: string;
  slug: string;
  description?: string | null;
  logoUrl?: string | null;
}

export function OrganizationHeader({
  name,
  slug,
  description,
  logoUrl,
}: OrganizationHeaderProps) {
  return (
    <div className="rounded-3xl bg-linear-to-r from-indigo-950 via-slate-900 to-indigo-900 p-8 sm:p-12 text-white shadow-xl text-center space-y-4">
      {/* Logo or Fallback Badge */}
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-white/10 p-2 backdrop-blur-xs border border-white/20 shadow-md">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={`${name} Logo`}
            className="h-full w-full object-contain rounded-xl"
          />
        ) : (
          <Building2 className="h-10 w-10 text-indigo-300" />
        )}
      </div>

      <div className="space-y-2">
        <span className="inline-block rounded-full bg-indigo-500/20 px-3.5 py-1 text-xs font-semibold text-indigo-200 border border-indigo-400/30">
          Official Organization Career Portal
        </span>
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">{name}</h1>
        {description && (
          <p className="max-w-2xl mx-auto text-xs sm:text-sm text-indigo-100/90 leading-relaxed pt-1">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
