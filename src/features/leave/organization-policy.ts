// Use the unique persisted organization slug, never a display name or leave code.
export function isSagaLeaveOrganization(organization: { slug: string } | null | undefined) {
  return organization?.slug === 'st-aloysius';
}
