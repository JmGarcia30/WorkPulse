'use client';

import { useActionState, useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { separationAction } from '../actions';
import { resolveTenantHref } from '@/lib/tenant/navigation';

export function ActionForm({ operation, caseId, version, children, label, navigate = false }: {
  operation: string; caseId?: string; version?: number; children?: ReactNode; label: string; navigate?: boolean;
}) {
  const [state, action, pending] = useActionState(separationAction, {});
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (state.caseId) {
      if (navigate) router.push(resolveTenantHref(`/dashboard/employees/exit/${state.caseId}`, pathname));
      else router.refresh();
    }
  }, [state, navigate, router, pathname]);
  return <form action={action} className="space-y-3">
    <input type="hidden" name="operation" value={operation} />
    {caseId && <input type="hidden" name="caseId" value={caseId} />}
    {version !== undefined && <input type="hidden" name="expectedVersion" value={version} />}
    <fieldset disabled={pending} className="space-y-3 disabled:opacity-60">{children}
      <button type="submit" className="rounded-md bg-[var(--tenant-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? 'Saving…' : label}</button>
    </fieldset>
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-green-800">{state.success}</p>}
  </form>;
}
