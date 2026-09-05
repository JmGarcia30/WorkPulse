'use client';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 my-8 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-[#181A1C] dark:text-slate-100 flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#181A1C] dark:text-white" />
              Prepare Employment Offer Package
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Candidate: <span className="font-semibold text-slate-700 dark:text-slate-300">{candidateName}</span> • Position: {jobTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:border-rose-900 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          {/* Compensation & Frequency Grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5 text-[#181A1C] dark:text-white" />
                Base Compensation / Salary *
              </label>
              <input
                type="number"
                step="0.01"
                min="1"
                required
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="e.g. 65000"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 font-bold focus:border-[#181A1C] focus:ring-1 focus:ring-[#181A1C] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Payment Frequency *
              </label>
              <select
                value={payFrequency}
                onChange={(e) => setPayFrequency(e.target.value as PayFrequency)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#181A1C] focus:ring-1 focus:ring-[#181A1C] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Employment Classification *
              </label>
              <input
                type="text"
                required
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                placeholder="e.g. Full-time Permanent, Contract"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#181A1C] focus:ring-1 focus:ring-[#181A1C] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-500" /> Start / Onboarding Date *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#181A1C] focus:ring-1 focus:ring-[#181A1C] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Offer Expiration Date */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-slate-500" /> Offer Response Expiration Date (Optional)
            </label>
            <input
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#181A1C] focus:ring-1 focus:ring-[#181A1C] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          {/* Benefits & Allowances */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Healthcare & Benefits Package
              </label>
              <textarea
                rows={2}
                value={benefits}
                onChange={(e) => setBenefits(e.target.value)}
                placeholder="e.g. Comprehensive HMO + 2 dependents, 15 VL, 15 SL..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#181A1C] focus:ring-1 focus:ring-[#181A1C] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Allowances & Stipends
              </label>
              <textarea
                rows={2}
                value={allowances}
                onChange={(e) => setAllowances(e.target.value)}
                placeholder="e.g. Rice allowance, clothing stipend, tech grant..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#181A1C] focus:ring-1 focus:ring-[#181A1C] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            </div>
          </div>

          {/* Additional Terms & Internal Notes */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Special Terms & Contingencies
            </label>
            <textarea
              rows={2}
              value={additionalTerms}
              onChange={(e) => setAdditionalTerms(e.target.value)}
              placeholder="e.g. Contingent upon PRC license verification and background clearance..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#181A1C] focus:ring-1 focus:ring-[#181A1C] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Internal HR Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Private comments for the hiring committee and approvers..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-[#181A1C] focus:ring-1 focus:ring-[#181A1C] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>

          {/* Submit Option */}
          <div className="rounded-xl bg-[#F8F9FA] p-3 border border-[#E8EAED] dark:bg-slate-950 dark:border-slate-800 flex items-center gap-2">
            <input
              type="checkbox"
              id="submitApproval"
              checked={submitForApproval}
              onChange={(e) => setSubmitForApproval(e.target.checked)}
              className="h-4 w-4 rounded border-[#E8EAED] text-[#181A1C] focus:ring-[#181A1C] dark:border-slate-700"
            />
            <label htmlFor="submitApproval" className="text-xs text-[#181A1C] dark:text-slate-300 cursor-pointer">
              Submit directly for management approval (<span className="font-bold">PENDING_APPROVAL</span>)
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[#E8EAED] pt-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-[#E8EAED] px-4 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#181A1C] hover:bg-[#F8F9FA] dark:border-slate-800 dark:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-[#181A1C] px-4 py-2 text-xs font-bold text-white hover:bg-[#2A2E33] disabled:opacity-50 transition shadow-2xs"
            >
              {loading ? 'Creating Offer...' : 'Create Offer Package'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
