'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ScanLine } from 'lucide-react';
import type { RfidScanResult } from '@/features/attendance/rfid-policy';

export function RfidKiosk({ organizationName, expiresInMs, timeZone, apiBase, loginPath }: {
  organizationName: string; expiresInMs: number; timeZone: string; apiBase: string; loginPath: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef<{ cardNumber: string; requestId: string } | null>(null);
  const inFlight = useRef(false);
  const [cardNumber, setCardNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RfidScanResult | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [locked, setLocked] = useState(false);
  const focus = useCallback(() => { if (!inFlight.current) input.current?.focus(); }, []);

  useEffect(() => {
    focus();
    window.addEventListener('focus', focus);
    return () => window.removeEventListener('focus', focus);
  }, [focus]);
  // Focus only after React has re-enabled the input following a scan/retry.
  useEffect(() => { if (!busy && !uncertain && !locked) focus(); }, [busy, uncertain, locked, focus]);
  useEffect(() => {
    if (!result?.employeeName) return;
    const timer = setTimeout(() => setResult(null), 10_000);
    return () => clearTimeout(timer);
  }, [result]);
  useEffect(() => {
    const timer = setTimeout(() => { setLocked(true); setResult({ code: 'KIOSK_EXPIRED', message: 'Kiosk session expired. Ask HR to authorize this device.' }); }, Math.max(0, expiresInMs));
    return () => clearTimeout(timer);
  }, [expiresInMs]);

  const submit = useCallback(async (value?: string) => {
    if (inFlight.current || locked) return;
    if (!pending.current) {
      if (!value || !/^\d{10}$/.test(value)) { setResult({ code: 'INVALID_INPUT', message: 'Scan a 10-digit numeric card.' }); setCardNumber(''); focus(); return; }
      pending.current = { cardNumber: value, requestId: crypto.randomUUID() };
    }
    inFlight.current = true; setBusy(true); setUncertain(false); setCardNumber(''); setResult(null);
    try {
      // Allow the server's 30-second write transaction plus authentication and
      // post-commit confirmation time. Every retry retains pending.current.
      const response = await fetch(`${apiBase}/scan`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pending.current), signal: AbortSignal.timeout(60_000) });
      const data = await response.json();
      if (response.status >= 500 || response.status === 429) throw new Error('UNCERTAIN');
      setResult('error' in data ? { code: data.code, message: data.error } : data);
      if (response.status === 401) setLocked(true);
      pending.current = null;
    } catch {
      setUncertain(true);
      setResult({ code: 'UNCERTAIN', message: 'Could not confirm this scan. Retry the same scan before scanning another card.' });
    } finally {
      inFlight.current = false; setBusy(false);
    }
  }, [apiBase, focus, locked]);

  // Readers without an Enter suffix submit after the complete 10-digit input settles.
  useEffect(() => {
    if (cardNumber.length !== 10 || busy || uncertain || locked) return;
    const timer = setTimeout(() => void submit(cardNumber), 180);
    return () => clearTimeout(timer);
  }, [cardNumber, busy, uncertain, locked, submit]);

  async function lock() {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true);
    try {
      const response = await fetch(`${apiBase}/kiosk`, { method: 'DELETE' });
      if (response.ok || response.status === 401) { setLocked(true); setResult(null); pending.current = null; setUncertain(false); }
      else setResult({ code: 'LOCK_FAILED', message: 'Kiosk could not be locked. Please try again.' });
    } catch { setResult({ code: 'LOCK_FAILED', message: 'Kiosk could not be locked. Please try again.' }); }
    finally { inFlight.current = false; setBusy(false); }
  }

  function onSubmit(event: FormEvent) { event.preventDefault(); void submit(cardNumber); }
  const success = result?.code === 'RECORDED';
  return <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12" onClick={event => { if (!(event.target as HTMLElement).closest('button,a,input')) focus(); }}>
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="wp-eyebrow">WorkPulse Attendance</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">{organizationName}</h1><p className="mt-2 text-sm text-[var(--wp-text-muted)]">{timeZone}</p></div>{!locked && <button type="button" className="wp-button-secondary" onClick={lock} disabled={busy}>Lock Kiosk</button>}</header>
    <section className="wp-card flex flex-1 flex-col justify-center gap-7 p-6 sm:p-12" aria-labelledby="scan-heading">
      <ScanLine className="size-10 text-[var(--tenant-accent)]" aria-hidden="true" />
      <div><h2 id="scan-heading" className="text-3xl font-semibold tracking-tight sm:text-4xl">{locked ? 'Kiosk locked' : busy ? 'Recording attendance…' : 'Scan your card'}</h2><p className="mt-3 text-[var(--wp-text-muted)]">{locked ? 'Ask HR to sign in and authorize this device.' : 'Hold your card to the reader. Your attendance will appear here.'}</p></div>
      {!locked && <form onSubmit={onSubmit} className="space-y-3"><label className="wp-label block">RFID card<input ref={input} className="wp-input mt-2 text-lg" type="password" inputMode="numeric" autoComplete="off" value={cardNumber} onChange={event => setCardNumber(event.target.value)} maxLength={32} disabled={busy || uncertain} onBlur={event => { if (!event.relatedTarget) setTimeout(focus, 0); }} aria-describedby="scan-help" /></label><p id="scan-help" className="text-sm text-[var(--wp-text-muted)]">Ready for a 10-digit card. Press Enter or wait briefly after scanning.</p><button className="wp-button-secondary" disabled={busy || uncertain || cardNumber.length !== 10}>Record Attendance</button></form>}
      <div role="status" aria-live="polite" aria-atomic="true" className={`min-h-36 rounded-lg border p-5 ${success ? 'border-green-200 bg-green-50 text-green-900' : result ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-[var(--wp-border)]'}`}>
        {result ? <><p className="text-lg font-semibold">{result.message}</p>{result.employeeName && <p className="mt-3 text-2xl font-semibold sm:text-3xl">{result.employeeName}</p>}{result.direction && result.occurredAt && result.timeZone && <><p className="mt-2 text-xl font-semibold">{result.direction === 'TIME_IN' ? 'Time In' : 'Time Out'}</p><time dateTime={result.occurredAt} className="mt-2 block text-lg tabular-nums">{new Intl.DateTimeFormat('en-PH', { timeZone: result.timeZone, dateStyle: 'full', timeStyle: 'medium' }).format(new Date(result.occurredAt))}</time></>}</> : <p className="text-[var(--wp-text-muted)]">{locked ? 'This device cannot record attendance until authorized.' : 'Ready for the next employee.'}</p>}
      </div>
      {uncertain && !locked && <button type="button" className="wp-button-primary self-start" disabled={busy} onClick={() => void submit()}>Retry Same Scan</button>}
      {locked && <Link href={loginPath} className="wp-button-primary self-start">HR Sign In</Link>}
    </section>
    <footer className="text-sm text-[var(--wp-text-muted)]">One Time In and Time Out per local day. Repeat scans within 60 seconds do not switch direction.</footer>
  </main>;
}
