import { TenantLink } from '@/components/ui/TenantLink';

export function PolicyGuidance({ existingCase = false }: { existingCase?: boolean }) {
  return <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
    Resignation notice requirements have not been configured. Ask your organization’s HR Administrator to configure the{' '}
    <TenantLink href="/dashboard/settings/exit" className="underline">resignation notice policy in organization settings</TenantLink>.
    {existingCase ? ' Then save this case’s editable details to capture the policy and continue processing.' : ' A resignation case cannot pass readiness until a policy is recorded.'}
  </p>;
}
