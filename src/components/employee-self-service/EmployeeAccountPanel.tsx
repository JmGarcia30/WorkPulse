'use client';

import { useState, useTransition } from 'react';
import { disableEmployeeAccountAction, enableEmployeeAccountAction, provisionEmployeeAccountAction, resendEmployeeInvitationAction } from '@/features/employee-self-service/actions';

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

export function EmployeeAccountPanel({ employeeId, contactEmail, employeeActive, account }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (operation: () => Promise<{ success?: boolean; error?: string; warning?: string }>) => startTransition(async () => {
    setMessage(null);
    const result = await operation();
    setMessage(result.error ?? result.warning ?? 'Employee account updated.');
  });
  return <section className="rounded-3xl border border-[#E8EAED] bg-white p-6 shadow-2xs lg:col-span-2"><h2 className="text-sm font-bold">Employee Account</h2><p className="mt-1 text-xs text-slate-500">Login identity is copied from the contact email only during provisioning. Later contact-email changes do not alter it.</p>
    <dl className="mt-4 grid gap-4 text-xs sm:grid-cols-3"><div><dt className="text-slate-500">Contact email</dt><dd className="font-bold">{contactEmail}</dd></div><div><dt className="text-slate-500">Login email</dt><dd className="font-bold">{account?.email ?? 'Not provisioned'}</dd></div><div><dt className="text-slate-500">Account status</dt><dd className="font-bold">{account?.status ?? 'NONE'}</dd></div>{account?.expiresAt && <div><dt className="text-slate-500">Invitation expires</dt><dd>{account.expiresAt}</dd></div>}{account?.activatedAt && <div><dt className="text-slate-500">Activated</dt><dd>{account.activatedAt}</dd></div>}{account?.disabledAt && <div><dt className="text-slate-500">Disabled</dt><dd>{account.disabledAt}</dd></div>}{account?.disabledReason && <div className="sm:col-span-3"><dt className="text-slate-500">Reason</dt><dd>{account.disabledReason}</dd></div>}</dl>
    {message && <p className="mt-4 rounded-xl bg-slate-100 p-3 text-xs">{message}</p>}
    <div className="mt-4 flex flex-wrap gap-2">
      {!account && <button disabled={pending || !employeeActive} onClick={() => window.confirm(`Create an employee login for ${contactEmail}?`) && run(() => provisionEmployeeAccountAction(employeeId, true))} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Create Employee Account</button>}
      {account?.status === 'INVITED' && <button disabled={pending} onClick={() => window.confirm('Rotate the existing link and send a new invitation?') && run(() => resendEmployeeInvitationAction(account.id, employeeId, true))} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white">Resend Invitation</button>}
      {account && account.status !== 'DISABLED' && <button disabled={pending} onClick={() => { const reason = window.prompt('Reason for disabling this account:'); if (reason && window.confirm('Disable this employee account?')) run(() => disableEmployeeAccountAction(account.id, employeeId, reason, true)); }} className="rounded-xl border border-rose-200 px-4 py-2 text-xs font-bold text-rose-700">Disable Account</button>}
      {account?.status === 'DISABLED' && <button disabled={pending || !employeeActive} onClick={() => window.confirm('Enable this employee account?') && run(() => enableEmployeeAccountAction(account.id, employeeId, true))} className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">Enable Account</button>}
    </div>
  </section>;
}
