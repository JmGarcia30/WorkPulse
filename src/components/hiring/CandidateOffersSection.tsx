'use client';

import { useState } from 'react';
import { OfferStatus, PayFrequency } from '@prisma/client';
import {
  OFFER_STAGE_CONFIG,
  PAY_FREQUENCY_CONFIG,
  isActiveOfferStatus,
} from '@/features/hiring/offer-pipeline';
import { OfferModal } from './OfferModal';
import { OfferStatusDialog } from './OfferStatusDialog';
import {
  FileText,
  Plus,
  Calendar,
  DollarSign,
  User,
  CheckCircle2,
  Clock,
  ArrowRightLeft,
  ShieldCheck,
} from 'lucide-react';

export interface CandidateOfferItem {
  id: string;
  salary: number;
  payFrequency: PayFrequency;
  employmentType: string;
  startDate: Date | string;
  expirationDate: Date | string | null;
  benefits: string | null;
  allowances: string | null;
  additionalTerms: string | null;
  notes: string | null;
  status: OfferStatus;
  createdAt: Date | string;
  createdBy: {
    id: string;
    name: string;
    role: string;
  };
  approvedBy?: {
    id: string;
    name: string;
    role: string;
  } | null;
}

interface CandidateOffersSectionProps {
  applicationId: string;
  candidateName: string;
  jobTitle: string;
  offers: CandidateOfferItem[];
  canManage: boolean;
  canApprove: boolean;
}

export function CandidateOffersSection({
  applicationId,
  candidateName,
  jobTitle,
  offers,
  canManage,
  canApprove,
}: CandidateOffersSectionProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedOfferForStatus, setSelectedOfferForStatus] =
    useState<CandidateOfferItem | null>(null);

  const hasActiveOffer = offers.some((o) => isActiveOfferStatus(o.status));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider dark:text-slate-400 flex items-center gap-2">
            <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            Employment Offers & Terms
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Compensation packages, approval tracking, and signed agreements
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            disabled={hasActiveOffer}
            title={hasActiveOffer ? 'An active offer is currently open' : 'Draft new offer'}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Offer Package
          </button>
        )}
      </div>

      {/* Offer Cards */}
      {offers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
          <FileText className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-700" />
          <p className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
            No employment offers drafted yet
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Prepare formal salary terms, benefits, and employment contracts for this applicant.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {offers.map((offer) => {
            const statusConfig = OFFER_STAGE_CONFIG[offer.status];
            const payFreqConfig = PAY_FREQUENCY_CONFIG[offer.payFrequency];
            const isActive = isActiveOfferStatus(offer.status);
            const isTerminal =
              offer.status === OfferStatus.ACCEPTED ||
              offer.status === OfferStatus.REJECTED ||
              offer.status === OfferStatus.WITHDRAWN ||
              offer.status === OfferStatus.EXPIRED;

            return (
              <div
                key={offer.id}
                className={`rounded-xl border p-4 transition space-y-3 ${
                  isActive
                    ? 'border-indigo-200 bg-indigo-50/20 dark:border-indigo-900/60 dark:bg-indigo-950/20'
                    : 'border-slate-200 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950/50'
                }`}
              >
                {/* Top Row: Compensation & Status */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center">
                        ₱{offer.salary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <span className="text-xs font-normal text-slate-500 ml-1">
                          {payFreqConfig.suffix}
                        </span>
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {offer.employmentType}
                      </span>
                      {isActive && (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          Active Offer
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`rounded-md px-2.5 py-1 text-xs font-bold ${statusConfig.badgeBg} ${statusConfig.badgeText}`}
                    >
                      {statusConfig.label}
                    </span>

                    {canManage && !isTerminal && (
                      <button
                        type="button"
                        onClick={() => setSelectedOfferForStatus(offer)}
                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-white px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-300"
                      >
                        <ArrowRightLeft className="h-3 w-3" /> Update Stage
                      </button>
                    )}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid gap-2 sm:grid-cols-3 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-[11px] text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>Start: {new Date(offer.startDate).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span>
                      {offer.expirationDate
                        ? `Expires: ${new Date(offer.expirationDate).toLocaleDateString()}`
                        : 'No expiration'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    <span>Created by: {offer.createdBy.name}</span>
                  </div>
                </div>

                {/* Approved info if available */}
                {offer.approvedBy && (
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Approved by: {offer.approvedBy.name} ({offer.approvedBy.role.replace('_', ' ')})</span>
                  </div>
                )}

                {/* Benefits / Terms */}
                {(offer.benefits || offer.allowances || offer.additionalTerms) && (
                  <div className="rounded-lg bg-white p-3 border border-slate-100 dark:bg-slate-900 dark:border-slate-800 space-y-1.5 text-xs">
                    {offer.benefits && (
                      <p className="text-slate-600 dark:text-slate-400">
                        <strong className="text-slate-800 dark:text-slate-200">Benefits:</strong> {offer.benefits}
                      </p>
                    )}
                    {offer.allowances && (
                      <p className="text-slate-600 dark:text-slate-400">
                        <strong className="text-slate-800 dark:text-slate-200">Allowances:</strong> {offer.allowances}
                      </p>
                    )}
                    {offer.additionalTerms && (
                      <p className="text-slate-600 dark:text-slate-400">
                        <strong className="text-slate-800 dark:text-slate-200">Terms:</strong> {offer.additionalTerms}
                      </p>
                    )}
                  </div>
                )}

                {/* Notes / Audit */}
                {offer.notes && (
                  <div className="text-[11px] text-slate-500 whitespace-pre-line italic">
                    {offer.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <OfferModal
          applicationId={applicationId}
          candidateName={candidateName}
          jobTitle={jobTitle}
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
        />
      )}

      {/* Status Update Dialog */}
      {selectedOfferForStatus && (
        <OfferStatusDialog
          offerId={selectedOfferForStatus.id}
          currentStatus={selectedOfferForStatus.status}
          candidateName={candidateName}
          isOpen={!!selectedOfferForStatus}
          onClose={() => setSelectedOfferForStatus(null)}
        />
      )}
    </div>
  );
}
