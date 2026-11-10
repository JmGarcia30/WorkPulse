'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Bell, CheckCircle2, CircleAlert, Clock3, FileText, CalendarDays, Wallet } from 'lucide-react';
import type { HrNotification } from '@/features/hr-notifications/read-model';
import { markHrNotificationRead } from '@/features/hr-notifications/actions';

const icons = { application: FileText, deadline: Clock3, leave: CalendarDays, payroll: Wallet, system: CircleAlert };

export function HrNotificationCenter({ notifications }: { notifications: HrNotification[] }) {
  const [items, setItems] = useState(notifications);
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const unread = items.filter(x => !x.read).length;
  const shown = tab === 'unread' ? items.filter(x => !x.read) : items;

  function markRead(key: string) {
    if (pending) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await markHrNotificationRead(key);
        if (result.error) { setError(result.error); return; }
        setItems(previous => previous.map(item => item.key === key ? { ...item, read: true } : item));
      } catch {
        setError('Unable to update notifications. Check your connection and retry.');
      }
    });
  }

  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#282934]">HR Notifications</h1>
        <p className="mt-1 text-sm text-slate-500">New applications, pending leave, closing jobs, payroll reminders and system events.</p>
      </div>
      <span className="self-start rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-[#282934]">{unread} unread</span>
    </div>
    <div className="flex gap-2" role="group" aria-label="Filter notifications">
      <button type="button" onClick={() => setTab('all')} aria-pressed={tab === 'all'} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === 'all' ? 'bg-[#282934] text-white' : 'bg-white text-[#282934]'}`}>All</button>
      <button type="button" onClick={() => setTab('unread')} aria-pressed={tab === 'unread'} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === 'unread' ? 'bg-[#282934] text-white' : 'bg-white text-[#282934]'}`}>Unread ({unread})</button>
    </div>
    {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {shown.length === 0 ? <div className="flex flex-col items-center gap-2 p-12 text-center"><CheckCircle2 className="h-8 w-8 text-slate-500"/><p className="font-semibold text-[#282934]">No notifications to show</p><p className="text-sm text-slate-500">New activity will appear here when HR needs attention.</p></div>
        : shown.map(item => {
          const Icon = icons[item.category];
          return <div key={item.key} className={`flex flex-col gap-3 border-b border-slate-100 p-4 last:border-0 sm:flex-row sm:items-start ${item.read ? 'bg-white' : 'bg-[#f7f6fb]'}`}>
            <div className="rounded-lg bg-white p-2 text-[#282934]"><Icon className="h-4 w-4" aria-hidden="true"/></div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-[#282934]">{item.title}{!item.read && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-indigo-600" aria-label="Unread"/>}</p>
              <p className="mt-1 text-sm text-slate-600">{item.description}</p>
              <p className="mt-1 text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={item.href} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-[#282934] hover:bg-slate-100">View record</Link>
              {!item.read && <button type="button" disabled={pending} onClick={() => markRead(item.key)} className="rounded-lg bg-[#282934] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{pending ? 'Saving…' : 'Mark as read'}</button>}
            </div>
          </div>;
        })}
    </div>
  </div>;
}

export function HrNotificationBell({ unread }: { unread: number }) {
  return <Link href="/dashboard/notifications" title="HR notifications" aria-label={`HR notifications, ${unread} unread`} className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-[#282934] hover:bg-slate-50">
    <Bell className="h-5 w-5" aria-hidden="true"/>
    {unread > 0 && <span className="absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
  </Link>;
}
