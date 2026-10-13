'use client';

import { DialogFrame } from '@/components/ui/DialogFrame';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PayFrequency, OfferStatus } from '@prisma/client';
import { createOfferAction } from '@/features/hiring/offer-actions';
import { PAY_FREQUENCY_CONFIG } from '@/features/hiring/offer-pipeline';
import { X, FileText, AlertCircle, Calendar, DollarSign } from 'lucide-react';

interface OfferModalProps {
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export function OfferModal({
  applicationId,
  candidateName,
  jobTitle,
  isOpen,
  onClose,
}: OfferModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [salary, setSalary] = useState('');
  const [payFrequency, setPayFrequency] = useState<PayFrequency>(PayFrequency.MONTHLY);
  const [employmentType, setEmploymentType] = useState('Full-time');
  const [startDate, setStartDate] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [benefits, setBenefits] = useState('');
  const [allowances, setAllowances] = useState('');
  const [additionalTerms, setAdditionalTerms] = useState('');
  const [notes, setNotes] = useState('');
  const [submitForApproval, setSubmitForApproval] = useState(true);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const numSalary = Number(salary);
    if (isNaN(numSalary) || numSalary <= 0) {
      setError('Base compensation / salary must be greater than 0.');
      return;
    }

    if (!startDate) {
      setError('Start date is required.');
      return;
    }

    if (expirationDate && new Date(expirationDate) <= new Date(startDate)) {
      setError('Expiration date must be after the start date.');
      return;
    }

    setLoading(true);

    try {
      const res = await createOfferAction({
        applicationId,
        salary: numSalary,
        payFrequency,
        employmentType,
        startDate,
        expirationDate: expirationDate || undefined,
        benefits: benefits || undefined,
        allowances: allowances || undefined,
        additionalTerms: additionalTerms || undefined,
        notes: notes || undefined,
        status: submitForApproval
          ? OfferStatus.PENDING_APPROVAL
          : OfferStatus.DRAFT,
      });

      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      setLoading(false);
      onClose();
      router.refresh();
    } catch {
      setError('An unexpected error occurred while generating the offer.');
      setLoading(false);
    }
  }

  return (
    <DialogFrame label="Create offer" onClose={onClose} busy={loading}>
      <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-[var(--wp-text)] flex items-center gap-2">
              <FileText className="h-5 w-5 text-[var(--wp-text)]" />
              Prepare Employment Offer Package
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Candidate: <span className="font-semibold text-slate-700">{candidateName}</span> • Position: {jobTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose} aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-md bg-rose-50 p-3 text-sm text-rose-700 border border-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-sm">
          {/* Compensation & Frequency Grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5 text-[var(--wp-text)]" />
                Base Compensation / Salary *
              </label>
              <input aria-label="Base Compensation / Salary"
                type="number"
                step="0.01"
                min="1"
                required
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="e.g. 65000"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 font-bold focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Payment Frequency *
              </label>
              <select aria-label="Payment Frequency"
                value={payFrequency}
                onChange={(e) => setPayFrequency(e.target.value as PayFrequency)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
              >
                {Object.values(PayFrequency).map((pf) => (
                  <option key={pf} value={pf}>
                    {PAY_FREQUENCY_CONFIG[pf].label} ({PAY_FREQUENCY_CONFIG[pf].suffix})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Employment Type & Start Date */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Employment Classification *
              </label>
              <input aria-label="Employment Classification"
                type="text"
                required
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                placeholder="e.g. Full-time Permanent, Contract"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-500" /> Start / Onboarding Date *
              </label>
              <input aria-label="Start / Onboarding Date"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
              />
            </div>
          </div>

          {/* Offer Expiration Date */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-slate-500" /> Offer Response Expiration Date (Optional)
            </label>
            <input aria-label="Offer Response Expiration Date (Optional)"
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
            />
          </div>

          {/* Benefits & Allowances */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Healthcare & Benefits Package
              </label>
              <textarea aria-label="Healthcare & Benefits Package"
                rows={2}
                value={benefits}
                onChange={(e) => setBenefits(e.target.value)}
                placeholder="e.g. Comprehensive HMO + 2 dependents, 15 VL, 15 SL..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Allowances & Stipends
              </label>
              <textarea aria-label="Allowances & Stipends"
                rows={2}
                value={allowances}
                onChange={(e) => setAllowances(e.target.value)}
                placeholder="e.g. Rice allowance, clothing stipend, tech grant..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
              />
            </div>
          </div>

          {/* Additional Terms & Internal Notes */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Special Terms & Contingencies
            </label>
            <textarea aria-label="Special Terms & Contingencies"
              rows={2}
              value={additionalTerms}
              onChange={(e) => setAdditionalTerms(e.target.value)}
              placeholder="e.g. Contingent upon PRC license verification and background clearance..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Internal HR Notes
            </label>
            <input aria-label="Internal HR Notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Private comments for the hiring committee and approvers..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-[var(--tenant-accent)] focus:ring-1 focus:ring-[var(--tenant-accent)]"
            />
          </div>

          {/* Submit Option */}
          <div className="rounded-md bg-[var(--wp-surface-subtle)] p-3 border border-[var(--wp-border)] flex items-center gap-2">
            <input
              type="checkbox"
              id="submitApproval"
              checked={submitForApproval}
              onChange={(e) => setSubmitForApproval(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--wp-border)] text-[var(--wp-text)] focus:ring-[var(--tenant-accent)]"
            />
            <label htmlFor="submitApproval" className="text-sm text-[var(--wp-text)] cursor-pointer">
              Submit directly for management approval (<span className="font-bold">PENDING_APPROVAL</span>)
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--wp-border)] pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-md border border-[var(--wp-border)] px-4 py-2 text-sm font-semibold text-[var(--wp-text-muted)] hover:text-[var(--wp-text)] hover:bg-[#F8F9FA]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-[var(--tenant-primary)] px-4 py-2 text-sm font-bold text-[var(--tenant-primary-foreground)] hover:brightness-95 disabled:opacity-50 transition"
            >
              {loading ? 'Creating Offer...' : 'Create Offer Package'}
            </button>
          </div>
        </form>
      </div>
    </DialogFrame>
  );
}
