'use client';

import Link from 'next/link';
import { type CSSProperties, FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ScanLine } from 'lucide-react';
import type { RfidScanResult } from '@/features/attendance/rfid-policy';
import { poppins } from '@/lib/fonts';

function KioskClock({ timeZone }: { timeZone: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(now);

  const dateStr = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(now);

  return (
    <div
      className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs sm:text-sm select-none"
      aria-label="Current date and time"
    >
      <span
        suppressHydrationWarning
        className="font-semibold text-base sm:text-lg text-[#282934] tabular-nums tracking-tight"
      >
        {timeStr}
      </span>
      <span className="text-[var(--wp-text-muted)] opacity-50 select-none" aria-hidden="true">
        |
      </span>
      <span
        suppressHydrationWarning
        className="font-medium text-xs sm:text-sm text-[var(--wp-text-muted)]"
      >
        {dateStr}
      </span>
    </div>
  );
}

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

  return (
    <main
      className={`flex min-h-screen min-h-[100dvh] w-full flex-col justify-between bg-[#FAF8F6] text-[#282934] ${poppins.variable} ${poppins.className} [&_button]:font-[inherit] [&_input]:font-[inherit]`}
      style={{
        fontFamily: 'var(--font-poppins), Poppins, sans-serif',
        backgroundColor: '#FAF8F6',
        color: '#282934',
        '--wp-background': '#FAF8F6',
        '--wp-text': '#282934',
      } as CSSProperties}
      onClick={event => { if (!(event.target as HTMLElement).closest('button,a,input')) focus(); }}
    >
      {/* 1. Full-Width Navigation Bar at the Very Top */}
      <nav
        aria-label="Kiosk navigation"
        className="flex w-full shrink-0 items-center justify-between gap-4 bg-[#282934] px-6 py-3.5 sm:px-10 sm:py-4"
      >
        <div className="flex min-w-0 flex-col text-left">
          <p className="text-[11px] font-semibold tracking-wider uppercase text-[var(--tenant-accent)] leading-none">
            RFID ATTENDANCE KIOSK
          </p>
          <h1 className="mt-1 text-base sm:text-lg font-semibold tracking-tight text-white leading-tight truncate">
            {organizationName}
          </h1>
          <p className="mt-0.5 text-xs text-[#B4B5C0] font-normal leading-tight">
            {timeZone}
          </p>
        </div>

        {!locked && (
          <button
            type="button"
            className="h-9 shrink-0 cursor-pointer rounded-lg border border-white/20 bg-transparent px-3.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-white/10 hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={lock}
            disabled={busy}
          >
            Lock Kiosk
          </button>
        )}
      </nav>

      {/* 2. Main Content — Centered in the available space between navbar and footer */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-5 sm:px-6 w-full my-auto">
        <div className="flex w-full max-w-[690px] flex-col gap-4 sm:gap-4.5 -translate-y-2 sm:-translate-y-3">
          {/* Live Date and Time Display above the main RFID scanning container */}
          <KioskClock timeZone={timeZone} />

          <section
            className="wp-card !border-0 !border-none flex flex-col gap-5 p-5 sm:p-7"
            style={{ borderWidth: 0, border: 'none' }}
            aria-labelledby="scan-heading"
          >
            <div className="flex flex-col gap-3.5">
              <ScanLine className="size-12 sm:size-14 text-[var(--tenant-accent)]" aria-hidden="true" />
              <div>
                <h2 id="scan-heading" className="text-xl sm:text-2xl font-semibold tracking-tight text-[#282934]">
                  {locked ? 'Kiosk locked' : busy ? 'Recording attendance…' : 'Scan your card'}
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-[var(--wp-text-muted)] font-normal">
                  {locked ? 'Ask HR to sign in and authorize this device.' : 'Hold your card to the reader. Your attendance will appear here.'}
                </p>
              </div>
            </div>

            {!locked && (
              <form onSubmit={onSubmit} className="space-y-3">
                <div>
                  <label htmlFor="rfid-card-input" className="wp-label text-xs sm:text-[13px] font-semibold text-[#282934]">
                    RFID card
                  </label>
                  <input
                    id="rfid-card-input"
                    ref={input}
                    className="wp-input mt-1.5 h-10 text-[15px] tracking-widest font-mono text-[#282934]"
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    value={cardNumber}
                    onChange={event => setCardNumber(event.target.value)}
                    maxLength={32}
                    disabled={busy || uncertain}
                    onBlur={event => { if (!event.relatedTarget) setTimeout(focus, 0); }}
                    aria-describedby="scan-help"
                  />
                  <p id="scan-help" className="mt-1 text-xs sm:text-[13px] text-[var(--wp-text-muted)] font-normal">
                    Ready for a 10-digit card. Press Enter or wait briefly after scanning.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-0.5">
                  <button
                    type="submit"
                    className="wp-button-secondary text-xs sm:text-sm font-semibold h-9 px-3.5 self-start sm:self-auto cursor-pointer disabled:cursor-not-allowed text-[#282934] !border !border-[#E5E5E5]"
                    style={{ borderColor: '#E5E5E5', borderWidth: '1px', borderStyle: 'solid' }}
                    disabled={busy || uncertain || cardNumber.length !== 10}
                  >
                    Record Attendance
                  </button>

                  {!result && (
                    <div
                      role="status"
                      aria-live="polite"
                      className="flex items-center gap-2 text-xs sm:text-[13px] text-[var(--wp-text-muted)] font-medium"
                    >
                      <span className="size-2 rounded-full bg-emerald-500 shrink-0" aria-hidden="true" />
                      <span>Ready for the next employee.</span>
                    </div>
                  )}
                </div>
              </form>
            )}

            {result && (
              <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className={`rounded-lg border p-3.5 sm:p-4.5 transition-all ${success
                    ? 'border-green-200 bg-green-50 text-green-900'
                    : 'border-amber-200 bg-amber-50 text-amber-950'
                  }`}
              >
                <p className="text-sm sm:text-base font-semibold">{result.message}</p>
                {result.employeeName && (
                  <p className="mt-1.5 text-lg sm:text-xl font-semibold text-[#282934]">
                    {result.employeeName}
                  </p>
                )}
                {result.direction && result.occurredAt && result.timeZone && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-sm">
                    <span className="font-semibold">
                      {result.direction === 'TIME_IN' ? 'Time In' : 'Time Out'}
                    </span>
                    <span className="opacity-40 select-none">|</span>
                    <time dateTime={result.occurredAt} className="tabular-nums font-medium">
                      {new Intl.DateTimeFormat('en-PH', {
                        timeZone: result.timeZone,
                        dateStyle: 'full',
                        timeStyle: 'medium',
                      }).format(new Date(result.occurredAt))}
                    </time>
                  </div>
                )}
              </div>
            )}

            {locked && !result && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-lg border border-[var(--wp-border)] p-3.5 text-xs sm:text-[13px] text-[var(--wp-text-muted)] font-medium"
              >
                This device cannot record attendance until authorized.
              </div>
            )}

            {uncertain && !locked && (
              <button
                type="button"
                className="wp-button-primary self-start text-xs sm:text-sm font-semibold h-9 px-3.5 cursor-pointer"
                disabled={busy}
                onClick={() => void submit()}
              >
                Retry Same Scan
              </button>
            )}

            {locked && (
              <Link
                href={loginPath}
                className="wp-button-primary self-start text-xs sm:text-sm font-semibold h-9 px-3.5"
              >
                HR Sign In
              </Link>
            )}
          </section>
        </div>
      </div>

      {/* 3. Footer — Position at the Bottom */}
      <footer className="w-full shrink-0 px-6 pt-2 pb-6 sm:px-10 sm:pb-8 text-center">
        <p className="text-xs sm:text-sm text-[var(--wp-text-muted)] font-normal text-center">
          One Time In and Time Out per local day. Repeat scans within 60 seconds do not switch direction.
        </p>
      </footer>
    </main>
  );
}
