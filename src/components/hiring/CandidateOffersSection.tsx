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
  User,
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
  probationaryTerms?: string | null;
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
}: CandidateOffersSectionProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedOfferForStatus, setSelectedOfferForStatus] =
    useState<CandidateOfferItem | null>(null);

  const hasActiveOffer = offers.some((o) => isActiveOfferStatus(o.status));

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-[var(--wp-border)] pb-4">
        <div>
          <h3 className="text-sm font-bold text-[var(--wp-text-muted)] uppercase tracking-wider flex items-center gap-2">
            <FileText className="h-4 w-4 text-[var(--wp-text)]" />
            Employment Offer / Contract
          </h3>
          <p className="text-xs text-[var(--wp-text-muted)] mt-0.5">
            institutional contract executed by the employee and the President with probationary terms
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            disabled={hasActiveOffer}
            title={hasActiveOffer ? 'An active offer is currently open' : 'Draft new offer'}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--tenant-primary)] px-3.5 py-1.5 text-sm font-bold text-[var(--tenant-primary-foreground)] hover:brightness-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="h-3.5 w-3.5" />
            Create Offer Package
          </button>
        )}
      </div>

      {/* Offer Cards */}
      {offers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--wp-border)] p-8 text-center">
          <FileText className="mx-auto h-8 w-8 text-[var(--wp-text-muted)]" />
          <p className="mt-2 text-sm font-bold text-[var(--wp-text)]">
            No employment offers drafted yet
          </p>
          <p className="text-xs text-[var(--wp-text-muted)] mt-0.5">
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
                className={`rounded-lg border p-4 transition space-y-3 ${
                  isActive
                    ? 'border-[#181A1C]/40 bg-[var(--wp-surface-subtle)] '
                    : 'border-[var(--wp-border)] bg-white '
                }`}
              >
                {/* Top Row: Compensation & Status */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-[var(--wp-text)] flex items-center">
                        ₱{offer.salary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        <span className="text-sm font-normal text-[var(--wp-text-muted)] ml-1">
                          {payFreqConfig.suffix}
                        </span>
                      </span>
                      <span className="rounded-[6px] bg-[#EEEDF1] px-2 py-[3px] text-xs font-semibold text-[#282934]">
                        {offer.employmentType}
                      </span>
                      {isActive && (
                        <span className="rounded-[6px] bg-[#E5F5EC] px-2 py-[3px] text-[10px] font-semibold text-[#18794E]">
                          Active Offer
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`rounded-[6px] px-2 py-[3px] text-xs font-semibold ${statusConfig.badgeBg} ${statusConfig.badgeText}`}
                    >
                      {statusConfig.label}
                    </span>

                    {canManage && !isTerminal && (
                      <button
                        type="button"
                        onClick={() => setSelectedOfferForStatus(offer)}
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--wp-border)] bg-white px-2.5 py-1 text-sm font-bold text-[var(--wp-text)] hover:bg-[var(--tenant-primary)] hover:text-[var(--tenant-primary-foreground)] transition"
                      >
                        <ArrowRightLeft className="h-3 w-3" /> Update Stage
                      </button>
                    )}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid gap-2 sm:grid-cols-3 pt-2 border-t border-slate-200/60 text-xs text-slate-600">
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
                  <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Approved by: {offer.approvedBy.name} ({offer.approvedBy.role.replace('_', ' ')})</span>
                  </div>
                )}

                {offer.probationaryTerms && <p className="rounded-lg border bg-white p-3 text-sm whitespace-pre-wrap"><strong>Agreed probation terms:</strong> {offer.probationaryTerms}</p>}
                {/* Benefits / Terms */}
                {(offer.benefits || offer.allowances || offer.additionalTerms) && (
                  <div className="rounded-lg bg-white p-3 border border-slate-100 space-y-1.5 text-sm">
                    {offer.benefits && (
                      <p className="text-slate-600">
                        <strong className="text-slate-800">Benefits:</strong> {offer.benefits}
                      </p>
                    )}
                    {offer.allowances && (
                      <p className="text-slate-600">
                        <strong className="text-slate-800">Allowances:</strong> {offer.allowances}
                      </p>
                    )}
                    {offer.additionalTerms && (
                      <p className="text-slate-600">
                        <strong className="text-slate-800">Terms:</strong> {offer.additionalTerms}
                      </p>
                    )}
                  </div>
                )}

                {/* Notes / Audit */}
                {offer.notes && (
                  <div className="text-xs text-slate-500 whitespace-pre-line italic">
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
