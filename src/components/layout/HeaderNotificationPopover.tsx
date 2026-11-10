'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Check, FileText, CalendarDays, Clock3, Wallet, CircleAlert } from 'lucide-react';
import { resolveTenantHref } from '@/lib/tenant/navigation';
import { markHrNotificationRead } from '@/features/hr-notifications/actions';
import { markEmployeeNotificationRead } from '@/features/employee-self-service/notification-popover';

export type HeaderNotification = {
  key: string;
  category: 'application' | 'deadline' | 'leave' | 'payroll' | 'system';
  title: string;
  description: string;
  href: string;
  createdAt: string;
  read: boolean;
};

const icons = {
  application: FileText,
  deadline: Clock3,
  leave: CalendarDays,
  payroll: Wallet,
  system: CircleAlert,
};

export function HeaderNotificationPopover({
  notifications,
  audience,
}: {
  notifications: HeaderNotification[];
  audience: 'hr' | 'employee';
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(notifications);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const unread = items.filter(item => !item.read).length;

  useEffect(() => { setItems(notifications); }, [notifications]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (container.current && !container.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  useEffect(() => { setOpen(false); setError(null); }, [pathname]);

  function markRead(key: string) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = audience === 'hr'
          ? await markHrNotificationRead(key)
          : await markEmployeeNotificationRead(key);
        if (result.error) { setError(result.error); return; }
        setItems(previous => previous.map(item => item.key === key ? { ...item, read: true } : item));
      } catch {
        setError('Could not update this notification. Check your connection and try again.');
      }
    });
  }

  return <div ref={container} className="relative shrink-0">
    <button
      type="button"
      ref={trigger}
      aria-label={`Notifications, ${unread} unread`}
      title="Notifications"
      aria-expanded={open}
      aria-haspopup="true"
      aria-controls={`notifications-${audience}`}
      onClick={() => { setOpen(value => !value); setError(null); }}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--wp-border)] bg-transparent text-[#282934] transition hover:bg-[var(--wp-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <Bell className="h-5 w-5" aria-hidden="true" />
      {unread > 0 && <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
    </button>
    {open && <section
      id={`notifications-${audience}`}
      aria-label={audience === 'hr' ? 'HR notifications' : 'Employee notifications'}
      className="fixed right-4 top-[74px] z-[70] w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white text-[#282934] shadow-[0_14px_45px_rgba(20,20,30,0.18)] sm:absolute sm:right-0 sm:top-12"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-bold">Notifications</h2>
        <span className="text-xs font-medium text-slate-500">{unread} unread</span>
      </div>
      {error && <p role="alert" className="m-3 rounded-md bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}
      <div className="max-h-[min(420px,60vh)] overflow-y-auto">
        {items.length === 0 ? <p className="px-5 py-9 text-center text-sm text-slate-500">You are all caught up. No notifications yet.</p> : items.map(item => {
          const Icon = icons[item.category];
          return <article key={item.key} className={`border-b border-slate-100 px-4 py-3 last:border-b-0 ${item.read ? 'bg-white' : 'bg-[#f7f7fb]'}`}>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#282934] shadow-sm"><Icon className="h-4 w-4" aria-hidden="true" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold leading-5">{item.title}</h3>
                  {!item.read && <span aria-label="Unread" className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600" />}
                </div>
                <p className="mt-0.5 text-xs leading-5 text-slate-600">{item.description}</p>
                <p className="mt-1 text-[11px] text-slate-400">{new Date(item.createdAt).toLocaleString('en-PH')}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <Link href={resolveTenantHref(item.href, pathname)} onClick={() => setOpen(false)} className="text-xs font-semibold text-[#282934] underline underline-offset-2 hover:text-[var(--tenant-primary)]">View record</Link>
                  {!item.read && <button type="button" disabled={pending} onClick={() => markRead(item.key)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#282934] disabled:opacity-40"><Check className="h-3.5 w-3.5" aria-hidden="true" />Mark as read</button>}
                </div>
              </div>
            </div>
          </article>;
        })}
      </div>
    </section>}
  </div>;
}
