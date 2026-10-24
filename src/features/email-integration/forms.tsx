'use client';
import { useActionState } from 'react';
import { connectEmailAction, disconnectEmailAction, testEmailAction, sagaRecruitmentSenderAction } from './actions';

export function EmailIntegrationControls({ configured, connected }: { configured: boolean; connected: boolean }) {
  const [connect, connectAction, connecting] = useActionState(connectEmailAction, {});
  const [test, testAction, testing] = useActionState(testEmailAction, {});
  const [disconnect, disconnectAction, disconnecting] = useActionState(disconnectEmailAction, {});
  const busy = connecting || testing || disconnecting;
  return <div className="space-y-6">
    <form action={connectAction} className="space-y-3"><button className="wp-button-primary" disabled={!configured || busy}>{connecting ? 'Connecting…' : connected ? 'Reconnect Google account' : 'Connect Google account'}</button>{connect.error && <p role="alert" className="wp-alert-danger">{connect.error}</p>}</form>
    {connected && <><form action={testAction} className="space-y-3">
      <label className="wp-label block">Test recipient email<input className="wp-input mt-2" type="email" name="recipient" required maxLength={254} autoComplete="email" autoCapitalize="none" placeholder="you@example.com" aria-describedby="test-recipient-help" /></label>
      <p id="test-recipient-help" className="text-sm text-[var(--wp-text-muted)]">Enter an inbox you can check. The test uses your organization’s connected Gmail account. Check that inbox to confirm delivery.</p>
      <button className="wp-button-secondary" disabled={!configured || busy}>{testing ? 'Sending…' : 'Send test email'}</button>{test.error && <p role="alert" className="wp-alert-danger">{test.error}</p>}{test.success && <p role="status">{test.success}</p>}</form>
    <form action={disconnectAction} className="space-y-3"><label className="flex gap-2 text-sm"><input type="checkbox" name="confirmed" value="yes" required />I confirm that recruitment emails will stop using this account.</label><button className="wp-button-secondary" disabled={busy}>{disconnecting ? 'Disconnecting…' : 'Disconnect'}</button></form></>}
    {disconnect.error && <p role="alert" className="wp-alert-danger">{disconnect.error}</p>}{disconnect.success && <p role="status">{disconnect.success}</p>}
  </div>;
}

export function SagaRecruitmentSenderControls({ active, canActivate }: { active: boolean; canActivate: boolean }) {
  const [state, action, pending] = useActionState(sagaRecruitmentSenderAction, {});
  return <form action={action} className="space-y-3 border-t pt-5">
    <input type="hidden" name="sender" value={active ? 'LEGACY' : 'GMAIL'} />
    <label className="flex gap-2 text-sm"><input type="checkbox" name="confirmed" value="yes" required />{active ? 'I confirm reverting SAGA recruitment to its existing sender.' : 'I confirm using the successfully tested Gmail account for SAGA recruitment.'}</label>
    <button className="wp-button-secondary" disabled={pending || (!active && !canActivate)}>{pending ? 'Updating sender…' : active ? 'Use existing SAGA sender' : 'Activate Gmail for recruitment'}</button>
    {state.error && <p role="alert" className="wp-alert-danger">{state.error}</p>}{state.success && <p role="status">{state.success}</p>}
  </form>;
}
