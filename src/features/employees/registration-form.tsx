'use client';
import { useActionState, useState } from 'react';
import { registerExistingEmployeeAction, changeEmployeeAccessRoleAction, linkExistingEmployeeAccountAction } from './registration-actions';
import { accessRoleLabels } from '@/lib/auth/access-roles';
import { TenantLink } from '@/components/ui/TenantLink';

type ExistingAccount = { id:string;name:string;email:string;role:string };
export function EmployeeRegistrationForm({ registrationKey,managementRoles,existingAccounts }: { registrationKey:string;managementRoles:boolean;existingAccounts:ExistingAccount[] }) {
  const [state,action,pending] = useActionState(registerExistingEmployeeAction,{});
  const [selectedRole, setSelectedRole] = useState<keyof typeof accessRoleLabels>('EMPLOYEE');
  const [existingAccountId, setExistingAccountId] = useState('');
  const [email, setEmail] = useState('');
  const linkedAccount = existingAccounts.find(account => account.id === existingAccountId);
  const managementAccess = managementRoles && selectedRole !== 'EMPLOYEE';
  const roleDescriptions: Record<keyof typeof accessRoleLabels, string> = {
    EMPLOYEE: 'Employee Self-Service only. No access to HR pages.',
    HR_ADMIN: 'HR Dashboard and personal Employee Self-Service. HR access requires an authorized Organization Administrator to assign this account role.',
    FINANCE_OFFICER: 'Personal Employee Self-Service only. No Finance or HR workspace is enabled for this role.',
    ORGANIZATION_HEAD: 'Personal Employee Self-Service only. No Executive or HR workspace is enabled for this role.',
  };
  function chooseLinkedAccount(accountId: string) {
    setExistingAccountId(accountId);
    const account = existingAccounts.find(item => item.id === accountId);
    if (account) {
      setEmail(account.email);
      setSelectedRole(account.role as keyof typeof accessRoleLabels);
    }
  }
  return <form action={action} className="wp-card space-y-6 p-5 sm:p-6" aria-busy={pending}>
    <input type="hidden" name="registrationKey" value={registrationKey}/>
    <fieldset disabled={pending || !!state.employeeId} className="space-y-5">
      <legend className="mb-3 font-semibold">Employee information</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        {([['firstName','First name',100],['lastName','Last name',100],['employeeNumber','Employee number',64],['phone','Phone number',40],['department','Department',120],['jobTitle','Job title',160]] as const).map(([name,label,max]) => <label className="wp-label" key={name}>{label}<input className="wp-input mt-2" name={name} maxLength={max} required/></label>)}
        <label className="wp-label">Email / account email<input className="wp-input mt-2" type="email" name="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)} readOnly={!!linkedAccount} required/>{linkedAccount && <span className="mt-1 block text-xs font-normal text-[var(--wp-text-muted)]">Email is locked to the selected existing account to prevent an incorrect account link.</span>}</label>
        <label className="wp-label">Employment date<input className="wp-input mt-2" type="date" name="startDate" required/></label>
        <label className="wp-label">Employee status<select className="wp-input mt-2" name="employeeStatus" defaultValue="ACTIVE"><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive (account disabled)</option></select></label>
        <label className="wp-label">Employment status<select className="wp-input mt-2" name="employmentStatus" defaultValue="REGULAR"><option value="REGULAR">Regular</option><option value="PROBATIONARY">Probationary</option></select></label>
        <label className="wp-label">Category<select className="wp-input mt-2" name="employmentCategory"><option value="NON_TEACHING">Non-teaching</option><option value="TEACHING">Teaching</option></select></label>
        <label className="wp-label">Employment type<input className="wp-input mt-2" name="employmentType" maxLength={100} placeholder="e.g. Full-time" required/></label>
        <label className="wp-label">Contract salary (PHP)<input className="wp-input mt-2" name="salary" type="number" min="0.01" step="0.01" max="9999999999.99" required/></label>
        <label className="wp-label">Pay frequency<select className="wp-input mt-2" name="payFrequency" defaultValue="MONTHLY"><option value="MONTHLY">Monthly</option><option value="SEMI_MONTHLY">Semi-monthly</option><option value="WEEKLY">Weekly</option><option value="BIWEEKLY">Biweekly</option><option value="ANNUAL">Annual</option><option value="HOURLY">Hourly</option></select></label>
      </div>
      <p className="text-sm text-[var(--wp-text-muted)]">Register existing employees using their actual employment details. Payroll compensation, schedules, statutory information and opening balances still require the existing payroll setup and review.</p>
      <details><summary className="cursor-pointer font-semibold">Probationary employment details</summary><div className="mt-3 space-y-3">
        <label className="wp-label block">SAGA teaching probation end date<input className="wp-input mt-2" type="date" name="probationEndDate"/></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="probationStandardsConfirmed" value="yes"/>For probationary employment, I verified the existing agreed contract and standards communicated at engagement. The current organization probation policy applies; this registration does not grant a new probation period.</label>
      </div></details>
      <div className="space-y-4 border-t pt-5">
        <div className="space-y-1">
          <h2 className="font-semibold">Employee WorkPulse access</h2>
          <p className="text-sm text-[var(--wp-text-muted)]">
            Choose the employee's account permissions separately from their job title. Being assigned to the HR department does not automatically grant HR system access.
          </p>
        </div>
        <label className="wp-label block">
          Account access type
          <select
            className="wp-input mt-2"
            name={linkedAccount ? undefined : 'role'}
            value={selectedRole}
            onChange={event => setSelectedRole(event.target.value as keyof typeof accessRoleLabels)}
            disabled={!!linkedAccount}
          >
            {Object.entries(accessRoleLabels)
              .filter(([key]) => managementRoles || key === 'EMPLOYEE')
              .map(([key,label]) => <option key={key} value={key}>{key === 'EMPLOYEE' ? 'Employee — ESS only' : key === 'HR_ADMIN' ? 'HR Administrator — HR Dashboard + ESS' : `${label} — ESS only`}</option>)}
          </select>
          {linkedAccount && <input type="hidden" name="role" value={selectedRole}/>}
        </label>
        <p role="status" className="text-sm text-[var(--wp-text-muted)]">{roleDescriptions[selectedRole]}</p>
        {managementRoles && (
          <label className="wp-label block">
            Employee login account
            <select className="wp-input mt-2" name="existingUserId" value={existingAccountId} onChange={event => chooseLinkedAccount(event.target.value)}>
              <option value="">Create a new account and send an invitation</option>
              {existingAccounts.map(account => (
                <option key={account.id} value={account.id}>{account.name} — {account.email} ({accessRoleLabels[account.role as keyof typeof accessRoleLabels]})</option>
              ))}
            </select>
            <span className="mt-2 block text-xs font-normal text-[var(--wp-text-muted)]">
              If this employee already has a WorkPulse HR login, select it here. Its verified email, assigned role and existing password are preserved; a duplicate login is not created.
            </span>
          </label>
        )}
        {linkedAccount && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="existingAccountLinkConfirmed" value="yes" required/>
            I verified this existing WorkPulse account belongs to the employee being registered.
          </label>
        )}
        {managementAccess && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="managementRoleConfirmed" value="yes" required/>
            I confirm this employee's elevated access role is authorized by the organization. Access changes are audited.
          </label>
        )}
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="sendInvitation" value="yes" defaultChecked disabled={!!linkedAccount}/>
          {linkedAccount
            ? 'The existing account keeps its current login; no new activation email is sent.'
            : 'Send an activation email for a new active employee account. Inactive employees receive no invitation.'}
        </label>
      </div>
      <label className="wp-label block">Registration reason / record reference<textarea className="wp-input mt-2" name="registrationReason" maxLength={1000} required/></label>
      <button className="wp-button-primary" disabled={pending}>{pending ? 'Registering...' : 'Register employee'}</button>
    </fieldset>
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    {state.success && <p role="status" className="text-sm text-emerald-700">{state.success}</p>}
    {state.warning && <p role="status" className="text-sm text-amber-800">{state.warning}</p>}
    {state.employeeId && <TenantLink className="wp-button-secondary inline-block" href={`/dashboard/employees/${state.employeeId}?tab=account`}>View employee and account</TenantLink>}
  </form>;
}
export function EmployeeAccessRoleForm({ employeeId,currentRole,active }: { employeeId:string;currentRole:string;active:boolean }) {
  const [state,action,pending] = useActionState(changeEmployeeAccessRoleAction,{});
  return <form action={action} className="wp-card space-y-4 p-5" aria-busy={pending}>
    <h3 className="font-semibold">Access role</h3><p className="text-sm">Only Organization Administrators can change roles. Job title and employee records remain unchanged. Finance and Executive workspaces are not enabled.</p>
    <input type="hidden" name="employeeId" value={employeeId}/>
    <label className="wp-label block">Assigned role<select className="wp-input mt-2" name="role" defaultValue={currentRole} disabled={!active || pending}>{Object.entries(accessRoleLabels).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    <label className="wp-label block">Reason<textarea className="wp-input mt-2" name="reason" required maxLength={1000} disabled={!active || pending}/></label>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmed" value="yes" required disabled={!active || pending}/>Confirm this change and revoke existing login sessions.</label>
    {!active && <p className="text-sm">Activate the employee account before changing its role. Pending invitations cannot be promoted.</p>}
    {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}{state.success && <p role="status" className="text-sm text-emerald-700">{state.success}</p>}
    <button className="wp-button-primary" disabled={!active || pending}>{pending ? 'Saving...' : 'Save access role'}</button>
  </form>;
}

export function ExistingEmployeeAccountLinkForm({employeeId,accounts}:{employeeId:string;accounts:ExistingAccount[]}){
  const [state,action,pending]=useActionState(linkExistingEmployeeAccountAction,{});
  return <form action={action} className="wp-card mb-5 space-y-3 p-5"><h3 className="font-semibold">Link an existing activated account</h3>
    <p className="text-sm">Only unlinked accounts matching this employee’s contact email are offered. Linking preserves the existing password and access role.</p>
    <input type="hidden" name="employeeId" value={employeeId}/><label className="wp-label block">Account<select className="wp-input mt-2" name="existingUserId" required defaultValue=""><option value="" disabled>Select matching account</option>{accounts.map(account=><option key={account.id} value={account.id}>{account.email} — {accessRoleLabels[account.role as keyof typeof accessRoleLabels]}</option>)}</select></label>
    <label className="wp-label block">Link reason<textarea className="wp-input mt-2" name="reason" maxLength={1000} required/></label>
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirmed" value="yes" required/>Confirm the account belongs to this employee.</label>
    {state.error&&<p role="alert" className="text-sm text-red-700">{state.error}</p>}{state.success&&<p role="status" className="text-sm text-emerald-700">{state.success}</p>}
    <button className="wp-button-primary" disabled={pending||!accounts.length}>{pending?'Linking...':'Link existing account'}</button></form>;
}
