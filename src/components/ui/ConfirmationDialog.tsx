'use client';

import React, { type ReactNode } from 'react';
import { DialogFrame } from './DialogFrame';
import { AlertTriangle, Loader2 } from 'lucide-react';

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: string;
  details?: Array<{ label: string; value: ReactNode }>;
  recordSummary?: Array<{ label: string; value: ReactNode }>;
  warning?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'danger' | 'warning' | 'primary';
  busy?: boolean;
  isLoading?: boolean;
  error?: string | null;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  details,
  recordSummary,
  warning = 'This action cannot be undone.',
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  busy = false,
  isLoading = false,
  error = null,
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  const isBusy = busy || isLoading;
  const items = details ?? recordSummary;

  const confirmBtnStyles =
    confirmVariant === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 text-white'
      : confirmVariant === 'warning'
      ? 'bg-amber-600 hover:bg-amber-700 text-white'
      : 'bg-[#282934] hover:bg-[#181923] text-white';

  return (
    <DialogFrame label={title} onClose={onClose} busy={isBusy}>
      <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-6 shadow-2xl space-y-4 my-8">
        {/* Header with Icon */}
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              confirmVariant === 'danger'
                ? 'bg-rose-50 text-rose-600'
                : 'bg-amber-50 text-amber-600'
            }`}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#282934]">{title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
          </div>
        </div>

        {/* Record Details summary card */}
        {items && items.length > 0 && (
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2 text-xs">
            {items.map((d) => (
              <div key={d.label} className="flex justify-between items-center gap-2">
                <span className="text-slate-500 font-medium">{d.label}</span>
                <span className="font-semibold text-[#282934] text-right truncate max-w-[240px]">
                  {d.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Error Feedback */}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 flex items-start gap-2"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="flex-1 leading-normal">{error}</p>
          </div>
        )}

        {/* Warning Callout */}
        {warning && (
          <p className="text-[11px] font-semibold text-rose-600">
            {warning}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold shadow-xs disabled:opacity-50 transition ${confirmBtnStyles}`}
          >
            {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </DialogFrame>
  );
}
