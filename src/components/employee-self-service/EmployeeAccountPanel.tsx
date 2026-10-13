'use client';

import { useState, useTransition } from 'react';
import { disableEmployeeAccountAction, enableEmployeeAccountAction, provisionEmployeeAccountAction, resendEmployeeInvitationAction } from '@/features/employee-self-service/actions';
import { DialogFrame } from '@/components/ui/DialogFrame';
import { formatStatusLabel } from '@/lib/ui/format-status';
import { Loader2, X } from 'lucide-react';

interface Props {
  employeeId: string;
  contactEmail: string;
  employeeActive: boolean;
  account: null | {
    id: string;
    email: string;
    status: string;
    expiresAt: string | null;
    activatedAt: string | null;
    disabledAt: string | null;
    disabledReason: string | null;
  };
}

type AccountAction = 'CREATE' | 'RESEND' | 'DISABLE' | 'ENABLE';
const titles: Record<AccountAction, string> = { CREATE: 'Create employee account', RESEND: 'Resend invitation', DISABLE: 'Disable employee account', ENABLE: 'Enable employee account' };
const explanations: Record<AccountAction, string> = {
  CREATE: 'Create a login using the employee contact email and send an activation invitation.',
  RESEND: 'Replace the existing activation link and send a new invitation. The previous link will stop working.',
  DISABLE: 'Disable access to employee self-service. Provide the reason for this account change.',
  ENABLE: 'Restore employee self-service access for this active employee.',
};
const timestamp = (value: string) => new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value));

export function EmployeeAccountPanel({ employeeId, contactEmail, employeeActive, account }: Props) {
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<AccountAction | null>(null);
  const [reason, setReason] = useState('');
  const close = () => { if (!pending) setMode(null); };
  const open = (action: AccountAction) => { setMessage(null); setReason(''); setMode(action); };
  const submit = () => startTransition(async () => {
    if (!mode || (mode !== 'CREATE' && !account)) return;
    setMessage(null);
    try {
      const result: { success?: boolean; error?: string; warning?: string } = mode === 'CREATE' ? await provisionEmployeeAccountAction(employeeId, true)
        : mode === 'RESEND' ? await resendEmployeeInvitationAction(account!.id, employeeId, true)
          : mode === 'DISABLE' ? await disableEmployeeAccountAction(account!.id, employeeId, reason, true)
            : await enableEmployeeAccountAction(account!.id, employeeId, true);
      setMessage({ text: result.error ?? result.warning ?? 'Employee account updated.', error: Boolean(result.error) });
      if (!result.error) setMode(null);
    } catch {
      setMessage({ text: 'Unable to update the employee account. Please try again.', error: true });
    }
  });
  const feedback = message ? <p role={message.error ? 'alert' : 'status'} className={message.error ? 'wp-alert-danger mt-4' : 'mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800'}>{message.text}</p> : null;
  return <section id="employee-account" className="rounded-lg border border-[var(--wp-border)] bg-white p-5 lg:col-span-2">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="wp-section-title">Employee self-service account</h2><span className="wp-status bg-[var(--wp-surface-subtle)]">{account ? formatStatusLabel(account.status) : 'Not provisioned'}</span></div>
    <p className="mt-2 text-sm text-[var(--wp-text-muted)]">Login identity is copied from the contact email only during provisioning. Later contact-email changes do not alter it.</p>
    <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
      <div><dt className="text-[var(--wp-text-muted)]">Contact email</dt><dd>{contactEmail}</dd></div>
      <div><dt className="text-[var(--wp-text-muted)]">Login email</dt><dd>{account?.email ?? 'Not provisioned'}</dd></div>
      <div><dt className="text-[var(--wp-text-muted)]">Account status</dt><dd>{account ? formatStatusLabel(account.status) : 'None'}</dd></div>
      {account?.expiresAt && <div><dt className="text-[var(--wp-text-muted)]">Invitation expires (UTC)</dt><dd title={account.expiresAt}>{timestamp(account.expiresAt)}</dd></div>}
      {account?.activatedAt && <div><dt className="text-[var(--wp-text-muted)]">Activated (UTC)</dt><dd title={account.activatedAt}>{timestamp(account.activatedAt)}</dd></div>}
      {account?.disabledAt && <div><dt className="text-[var(--wp-text-muted)]">Disabled (UTC)</dt><dd title={account.disabledAt}>{timestamp(account.disabledAt)}</dd></div>}
      {account?.disabledReason && <div className="sm:col-span-3"><dt className="text-[var(--wp-text-muted)]">Reason</dt><dd>{account.disabledReason}</dd></div>}
    </dl>
    {!mode && feedback}
    <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
      {!account && <button type="button" disabled={pending || !employeeActive} onClick={() => open('CREATE')} className="wp-button-primary">Create Employee Account</button>}
      {account?.status === 'INVITED' && <button type="button" disabled={pending} onClick={() => open('RESEND')} className="wp-button-secondary">Resend Invitation</button>}
      {account && account.status !== 'DISABLED' && <button type="button" disabled={pending} onClick={() => open('DISABLE')} className="wp-button-secondary text-[var(--wp-danger)]">Disable Account</button>}
      {account?.status === 'DISABLED' && <button type="button" disabled={pending || !employeeActive} onClick={() => open('ENABLE')} className="wp-button-primary">Enable Account</button>}
    </div>
    {mode && <DialogFrame label={titles[mode]} onClose={close} busy={pending}>
      <div className="w-full max-w-lg space-y-4 p-5">
        <div className="flex items-start justify-between gap-4"><h3 className="wp-section-title">{titles[mode]}</h3><button type="button" disabled={pending} onClick={close} aria-label="Close dialog" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border"><X className="h-4 w-4" /></button></div>
        <p className="text-sm text-[var(--wp-text-muted)]">{explanations[mode]}</p>
        <p className="break-words rounded-md bg-[var(--wp-surface-subtle)] p-3 text-sm font-semibold">{mode === 'CREATE' ? contactEmail : account?.email}</p>
        {mode === 'DISABLE' && <label className="wp-label">Reason for disabling<textarea required value={reason} onChange={event => setReason(event.target.value)} rows={3} className="wp-input mt-2" /></label>}
        {feedback}
        <div className="flex justify-end gap-2 border-t pt-4"><button type="button" disabled={pending} onClick={close} className="wp-button-secondary">Cancel</button><button type="button" onClick={submit} disabled={pending || (mode === 'DISABLE' && !reason.trim())} className="wp-button-primary">{pending && <Loader2 className="h-4 w-4 animate-spin" />}Confirm</button></div>
      </div>
    </DialogFrame>}
  </section>;
}
