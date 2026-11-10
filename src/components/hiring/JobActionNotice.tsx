'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';

const messages = {
  closed: 'Posting closed. New applications are no longer accepted.',
  archived: 'Posting archived. Previous applications and history were preserved.',
  reused: 'New draft created. Review the copied details and closing date before publishing.',
} as const;

export function JobActionNotice({ notice }: { notice?: string }) {
  const message = notice && Object.prototype.hasOwnProperty.call(messages, notice)
    ? messages[notice as keyof typeof messages] : null;
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setVisible(false), 7000);
    return () => window.clearTimeout(timer);
  }, [message]);
  if (!message || !visible) return null;
  return <div
    role="status"
    aria-live="polite"
    className="fixed bottom-5 right-5 z-[90] flex max-w-[calc(100vw-2rem)] items-start gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-[#282934] shadow-xl sm:max-w-sm"
  >
    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
    <span className="flex-1">{message}</span>
    <button
      type="button"
      aria-label="Dismiss notification"
      onClick={() => setVisible(false)}
      className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
    ><X className="h-4 w-4" aria-hidden="true" /></button>
  </div>;
}
