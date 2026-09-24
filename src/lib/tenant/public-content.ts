export type PublicTenantAnnouncement = {
  title: string;
  description: string;
  date?: string;
  imageUrl?: string;
  href?: string;
};

export type PublicTenantContent = {
  organizationShortName: string;
  organizationNavigationName: string;
  workspaceLabel: string;
  heroImageUrl?: string;
  announcements: PublicTenantAnnouncement[];
};

const tenantContent: Record<string, PublicTenantContent> = {
  'st-aloysius': {
    organizationShortName: 'SAGA',
    organizationNavigationName: 'St. Aloysius Gonzaga Academy',
    workspaceLabel: 'SAGA workspace',
    announcements: [
      {
        title: 'School Admission 2026–2027',
        description: 'St. Aloysius Gonzaga Academy, Inc. is accepting applications for Academic Year 2026–2027.',
        imageUrl: '/branding/saga/admissions-2026-2027.jpg',
      },
    ],
  },
};

export function getPublicTenantContent(organizationSlug: string): PublicTenantContent {
  return tenantContent[organizationSlug] ?? {
    organizationShortName: 'your organization',
    organizationNavigationName: 'Organization workspace',
    workspaceLabel: 'Organization workspace',
    announcements: [],
  };
}
