import Image from 'next/image';
import type { OrganizationBrandingView } from '@/features/organization-branding/read-model';

export function TenantLogo({ branding, size, className = '', fallbackClassName = '', priority = false }: {
  branding: OrganizationBrandingView;
  size: number;
  className?: string;
  fallbackClassName?: string;
  priority?: boolean;
}) {
  const source = branding.hasLogo
    ? `/api/branding/logo?v=${encodeURIComponent(branding.updatedAt)}`
    : branding.legacyLogoUrl;

  if (source) {
    return <Image src={source} alt={`${branding.displayName} logo`} width={size} height={size} className={className} priority={priority} unoptimized={source.startsWith('/')} />;
  }

  return <span className={fallbackClassName} style={{ width: size, height: size }} aria-hidden="true">{branding.displayName.slice(0, 2).toUpperCase()}</span>;
}
