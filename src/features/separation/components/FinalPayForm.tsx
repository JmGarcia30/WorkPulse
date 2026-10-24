'use client';
import { useActionState, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { finalPayAction } from '../final-pay-actions';

export function FinalPayForm({ operation, caseId, version, children, label }: { operation: string; caseId?: string; version?: number; children?: ReactNode; label: string }) {
  const [state, action, pending] = useActionState(finalPayAction, {});
  const router = useRouter();
  useEffect(() => { if (state.success) router.refresh(); }, [state, router]);
  return <form action={action} className="space-y-3">
    <input type="hidden" name="finalPayOperation" value={operation} />
    {caseId && <input type="hidden" name="caseId" value={caseId} />}
    {version !== undefined && <input type="hidden" name="expectedVersion" value={version} />}
    <fieldset disabled={pending} className="space-y-3 disabled:opacity-60">{children}<button className="wp-button-primary" type="submit">{pending ? 'Saving…' : label}</button></fieldset>
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-green-800">{state.success}</p>}
  </form>;
}
