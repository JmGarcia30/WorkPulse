'use client';

import { FormEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { deactivateRfidCard, enrollRfidCard, searchRfidEmployees } from '@/features/attendance/rfid-actions';

type Employee = { id: string; firstName: string; lastName: string; employeeNumber: string; employeeStatus: string; rfidCards: { id: string; createdAt: string }[] };

export function RfidEnrollment({ apiBase, kioskPath }: { apiBase: string; kioskPath: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [cardNumber, setCardNumber] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [searched, setSearched] = useState(false);
  const cardInput = useRef<HTMLInputElement>(null);

  async function search(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setSelected(null); setMessage(''); setCardNumber('');
    try {
      const result = await searchRfidEmployees(query);
      if ('error' in result) { setMessage(result.error); setEmployees([]); }
      else { setEmployees(result.employees); setSearched(true); }
    } catch { setMessage('Employee search is unavailable. Please try again.'); }
    finally { setBusy(false); }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!selected || busy) return;
    setBusy(true); setMessage('');
    try {
      const result = await enrollRfidCard({ employeeId: selected.id, cardNumber, expectedCardId: selected.rfidCards[0]?.id ?? null });
      if ('error' in result) setMessage(result.error);
      else { setMessage('Card assigned successfully. Search again to manage the assignment.'); setSelected(null); setEmployees([]); router.refresh(); }
    } catch { setMessage('Assignment could not be confirmed. Search again before retrying.'); }
    finally { setCardNumber(''); setBusy(false); }
  }

  async function deactivate() {
    const id = selected?.rfidCards[0]?.id;
    if (!id || busy) return;
    setBusy(true); setMessage('');
    try {
      const result = await deactivateRfidCard(id);
      if ('error' in result) setMessage(result.error);
      else { setMessage('Card deactivated. It can no longer record attendance.'); setSelected(null); setEmployees([]); router.refresh(); }
    } catch { setMessage('Deactivation could not be confirmed. Search again before retrying.'); }
    finally { setBusy(false); setCardNumber(''); }
  }

  async function startKiosk() {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`${apiBase}/kiosk`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) { setMessage(result.error); setBusy(false); return; }
      // Full navigation clears the HR client router state after its cookie is removed.
      window.location.replace(kioskPath);
    } catch { setMessage('Kiosk authorization could not be confirmed. Refresh this page before retrying.'); setBusy(false); }
  }

  return <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
    <section className="wp-card space-y-5 p-5" aria-labelledby="enrollment-heading">
      <div><h2 id="enrollment-heading" className="wp-section-title">Card enrollment</h2><p className="mt-1 text-sm text-[var(--wp-text-muted)]">Find an employee, select their record, then scan the card.</p></div>
      <form onSubmit={search} className="flex flex-wrap items-end gap-3">
        <label className="wp-label min-w-48 flex-1">Employee name or number<input className="wp-input mt-1" value={query} onChange={event => setQuery(event.target.value)} minLength={2} maxLength={80} required disabled={busy} /></label>
        <button className="wp-button-secondary" disabled={busy}>Search</button>
      </form>
      {employees.length > 0 && <ul className="divide-y divide-[var(--wp-border)]">{employees.map(employee => <li key={employee.id}><button type="button" className="flex w-full items-center justify-between gap-3 px-2 py-3 text-left focus-visible:outline-2 focus-visible:outline-[var(--wp-focus)]" aria-pressed={selected?.id === employee.id} disabled={busy || employee.employeeStatus !== 'ACTIVE'} onClick={() => { setSelected(employee); setCardNumber(''); setMessage(''); setTimeout(() => cardInput.current?.focus(), 0); }}><span><strong>{employee.firstName} {employee.lastName}</strong><span className="block text-sm text-[var(--wp-text-muted)]">{employee.employeeNumber}</span></span><span className="text-sm text-[var(--wp-text-muted)]">{employee.employeeStatus !== 'ACTIVE' ? 'Inactive employee' : employee.rfidCards.length ? 'Card assigned' : 'No active card'}</span></button></li>)}</ul>}
      {searched && !employees.length && !selected && <p className="text-sm text-[var(--wp-text-muted)]">No employees displayed. Search by name or employee number.</p>}
      {selected && <form onSubmit={save} className="space-y-4 border-t border-[var(--wp-border)] pt-5">
        <p className="font-semibold">{selected.firstName} {selected.lastName} · {selected.employeeNumber}</p>
        {selected.rfidCards.length > 0 && <p className="text-sm text-[var(--wp-warning)]">Assigning a replacement immediately deactivates the current card.</p>}
        <label className="wp-label block">Scan {selected.rfidCards.length ? 'replacement' : 'new'} card<input ref={cardInput} type="password" inputMode="numeric" autoComplete="off" className="wp-input mt-1" value={cardNumber} onChange={event => setCardNumber(event.target.value)} pattern="[0-9]{10}" maxLength={32} required disabled={busy} aria-describedby="rfid-card-help" /></label>
        <p id="rfid-card-help" className="text-xs text-[var(--wp-text-muted)]">10 numeric digits. Leading zeroes are preserved. Press Enter to assign.</p>
        <div className="flex flex-wrap gap-3"><button disabled={busy} className="wp-button-primary">{busy ? 'Saving…' : selected.rfidCards.length ? 'Replace Card' : 'Assign Card'}</button>{selected.rfidCards.length > 0 && <button disabled={busy} type="button" onClick={deactivate} className="wp-button-secondary">Deactivate Current Card</button>}</div>
      </form>}
      <p role="status" aria-live="polite" className="text-sm font-medium">{message}</p>
    </section>
    <section className="wp-card space-y-4 self-start p-5" aria-labelledby="kiosk-heading">
      <h2 id="kiosk-heading" className="wp-section-title">Attendance kiosk</h2>
      <p className="text-sm text-[var(--wp-text-muted)]">Connect the USB reader and authorize this browser for up to eight hours. Employees scan their registered cards to record attendance.</p>
      <p className="text-sm text-[var(--wp-text-muted)]">Opening kiosk mode signs you out of HR on this browser. Use a dedicated device or browser profile.</p>
      <button type="button" className="wp-button-primary" onClick={startKiosk} disabled={busy}>Authorize &amp; Open Kiosk</button>
      <p className="text-xs text-[var(--wp-text-muted)]">Cards contain only their existing numeric identifier. WorkPulse does not write employee information to cards.</p>
    </section>
  </div>;
}
