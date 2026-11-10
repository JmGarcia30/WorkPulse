'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, Check, ChevronRight, X } from 'lucide-react';
import { resolveTenantHref } from '@/lib/tenant/navigation';

export type NotificationPopoverItem = {
  key: string;
  title: string;
  description: string;
  createdAt: string;
  href: string;
  read: boolean;
};

export function NotificationPopover({
  label,
  initialItems,
  markRead,
}: {
  label: string;
  initialItems: NotificationPopoverItem[];
  markRead: (key: string) => Promise<{ success?: true; error?: string }>;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const unread = items.filter(item => !item.read).length;

  useEffect(() => { setItems(initialItems); }, [initialItems]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', dismiss); document.removeEventListener('keydown', escape); };
  }, [open]);

  function updateRead(key: string) {
    if (busy) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await markRead(key);
        if (!result.success) { setError(result.error || 'Could not update this notification.'); return; }
        setItems(current => current.map(item => item.key === key ? { ...item, read: true } : item));
        router.refresh();
      } catch {
        setError('Unable to update the notification. Please try again.');
      }
    });
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label={`${label}: ${unread} unread`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => { setOpen(value => !value); setError(null); }}
        className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--wp-border)] bg-white/50 text-[#282934] transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <Bell className="h-5 w-5" aria-hidden="true"/>
        {unread > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(370px,calc(100vw-38px))] max-h-[min(510px,calc(100dvh-92px))] overflow-hidden rounded-xl border border-slate-200 bg-white text-[#282934] shadow-2xl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">Notifications</span>
              {unread > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold">{unread} unread</span>}
            </div>
            <button aria-label="Close notifications" type="button" className="rounded-md p-1 text-slate-500 hover:bg-slate-100" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button>
          </div>
          {error && <p role="alert" className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">{error}</p>}
          <div className="max-h-[min(420px,calc(100dvh-165px))] overflow-y-auto overscroll-contain">
            {items.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500">No notifications yet.</div>
            ) : items.map(item => (
              <div key={item.key} className={`flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-0 ${item.read ? 'bg-white' : 'bg-[#f7f6fb]'}`}>
                <span className="mt-1 rounded-lg bg-white p-2 text-[#282934] shadow-sm"><Bell className="h-4 w-4" aria-hidden="true"/></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold leading-snug">{item.title}</span>
                    {!item.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-600" aria-label="Unread"/>}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">{item.description}</p>
                  <time dateTime={item.createdAt} className="mt-1 block text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleString('en-PH')}</time>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <Link href={resolveTenantHref(item.href, pathname)} onClick={() => setOpen(false)} className="inline-flex items-center gap-0.5 text-xs font-semibold text-[#282934] hover:underline">View record <ChevronRight className="h-3 w-3"/></Link>
                    {!item.read && <button type="button" disabled={busy} onClick={() => updateRead(item.key)} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-[#282934] disabled:opacity-50"><Check className="h-3 w-3"/>Mark as read</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
