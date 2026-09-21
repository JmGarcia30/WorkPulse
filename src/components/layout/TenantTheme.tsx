import type { CSSProperties, ReactNode } from 'react';
import type { OrganizationBrandingView } from '@/features/organization-branding/read-model';

export function TenantTheme({ branding, children, className = '' }: { branding: OrganizationBrandingView; children: ReactNode; className?: string }) {
  const style = {
    '--tenant-primary': branding.primary,
    '--tenant-primary-foreground': branding.primaryForeground,
    '--tenant-accent': branding.accent,
    '--tenant-accent-foreground': branding.accentForeground,
  } as CSSProperties;
  return <div style={style} className={className}>{children}</div>;
}
