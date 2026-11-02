'use client';
import { useActionState } from 'react';
import { ownNameAction, ownPasswordAction } from './actions';

export function OwnProfileForms({ name }: { name: string }) {
  const [profile, saveName, saving] = useActionState(ownNameAction, {});
  const [password, changePassword, changing] = useActionState(ownPasswordAction, {});
  return <div className="grid gap-6 lg:grid-cols-2">
    <form action={saveName} aria-busy={saving} className="wp-card space-y-4 p-6">
      <h2 className="text-lg font-bold">My name</h2>
      <label className="wp-label">Full name<input className="wp-input mt-2" name="name" defaultValue={name} required minLength={2} maxLength={100} autoComplete="name" /></label>
      {profile.error && <p role="alert" className="wp-alert-danger">{profile.error}</p>}
      {profile.success && <p role="status">{profile.success}</p>}
      <button className="wp-button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save my name'}</button>
    </form>
    <form action={changePassword} aria-busy={changing} className="wp-card space-y-4 p-6">
      <h2 className="text-lg font-bold">Change password</h2>
      <p className="text-sm">Use 14–72 characters, at most 72 UTF-8 bytes. All your sessions will be signed out after the change.</p>
      <label className="wp-label">Current password<input className="wp-input mt-2" type="password" name="currentPassword" required maxLength={72} autoComplete="current-password" /></label>
      <label className="wp-label">New password<input className="wp-input mt-2" type="password" name="password" required minLength={14} maxLength={72} autoComplete="new-password" /></label>
      <label className="wp-label">Confirm new password<input className="wp-input mt-2" type="password" name="confirmation" required minLength={14} maxLength={72} autoComplete="new-password" /></label>
      {password.error && <p role="alert" className="wp-alert-danger">{password.error}</p>}
      <button className="wp-button-primary" disabled={changing}>{changing ? 'Changing…' : 'Change my password'}</button>
    </form>
  </div>;
}
