'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, CalendarDays, Check, Clock3, FileText, Wallet, X } from 'lucide-react';
import { resolveTenantHref } from '@/lib/tenant/navigation';

export type NotificationPreview = {
  key: string;
  category: 'application' | 'deadline' | 'leave' | 'payroll' | 'system';
  title: string;
  description: string;
  href: string;
  createdAt: string;
  read: boolean;
};

type Props = {
  notifications: NotificationPreview[];
  label: string;
  onMarkRead: (key: string) => Promise<{ success?: true; error?: string }>;
  allHref?: string;
};

const categoryIcons = {
  application: FileText,
  deadline: Clock3,
  leave: CalendarDays,
  payroll: Wallet,
  system: Bell,
};

export function NotificationBellDropdown({ notifications, label, onMarkRead, allHref }: Props) {
  const pathname = usePathname();
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(notifications);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => setItems(notifications), [notifications]);
  useEffect(() => { setOpen(false); setError(null); }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const unread = items.filter(item => !item.read).length;
  const visible = [...items].sort((a, b) =>
    Number(a.read) - Number(b.read) || b.createdAt.localeCompare(a.createdAt)
  ).slice(0, 8);

  function markRead(key: string) {
    if (pending) return;
    setBusyKey(key);
    setError(null);
    startTransition(async () => {
      try {
        const result = await onMarkRead(key);
        if (result.error) {
          setError(result.error);
        } else if (result.success) {
          setItems(current => current.map(item => item.key === key ? { ...item, read: true } : item));
        }
      } catch {
        setError('Unable to update this notification. Please try again.');
      } finally {
        setBusyKey(null);
      }
    });
  }

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`${label}: ${unread} unread`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen(value => !value)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--wp-border)] bg-white/70 text-[#282934] transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#282934]"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {unread > 0 && (
          <span aria-hidden="true" className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <section
          id={panelId}
          role="dialog"
          aria-label={label}
          className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(370px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white text-[#282934] shadow-[0_16px_45px_rgba(17,24,39,0.18)]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="font-bold text-sm">Notifications</h2>
              {unread > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold">{unread} new</span>}
            </div>
            <button type="button" aria-label="Close notifications" onClick={() => setOpen(false)} className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
              <X className="h-4 w-4" aria-hidden="true"/>
            </button>
          </div>
          {error && <p role="alert" className="mx-3 mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p>}
          <div className="max-h-[min(400px,60vh)] overflow-y-auto" role="list">
            {visible.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <Check className="h-6 w-6 text-slate-500" aria-hidden="true"/>
                <p className="text-sm font-semibold">You're all caught up</p>
                <p className="text-xs text-slate-500">New updates will appear here.</p>
              </div>
            ) : visible.map(item => {
              const Icon = categoryIcons[item.category];
              return (
                <div key={item.key} role="listitem" className={`flex gap-3 border-b border-slate-100 px-4 py-3 last:border-0 ${item.read ? 'bg-white' : 'bg-slate-50'}`}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#282934]">
                    <Icon className="h-4 w-4" aria-hidden="true"/>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="min-w-0 text-xs font-bold leading-5">{item.title}</p>
                      {!item.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600" aria-label="Unread" />}
                    </div>
                    <p className="mt-0.5 text-xs leading-5 text-slate-600">{item.description}</p>
                    <p className="mt-1 text-[11px] text-slate-400">{new Date(item.createdAt).toLocaleString('en-PH')}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] font-semibold">
                      <Link href={resolveTenantHref(item.href, pathname)} onClick={() => setOpen(false)} className="text-[#282934] underline-offset-2 hover:underline">View record</Link>
                      {!item.read && (
                        <button type="button" disabled={pending} onClick={() => markRead(item.key)} className="text-[#282934] underline-offset-2 hover:underline disabled:opacity-50">
                          {busyKey === item.key ? 'Saving…' : 'Mark as read'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {allHref && (
            <Link href={resolveTenantHref(allHref, pathname)} onClick={() => setOpen(false)}
              className="block border-t border-slate-100 px-4 py-3 text-center text-xs font-semibold text-[#282934] hover:bg-slate-50">
              View all notifications
            </Link>
          )}
        </section>
      )}
    </div>
  );
}
