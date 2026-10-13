'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Native modal semantics provide focus containment, Escape, and focus restoration. */
export function DialogFrame({ children, label, onClose, busy = false, className = '' }: {
  children: ReactNode;
  label: string;
  onClose: () => void;
  busy?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    dialog.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return <dialog ref={ref} tabIndex={-1} aria-label={label} aria-busy={busy}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    className={`wp-dialog ${className}`}>{children}</dialog>;
}
