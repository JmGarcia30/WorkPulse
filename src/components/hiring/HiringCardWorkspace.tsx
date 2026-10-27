'use client';

import React, { useState } from 'react';
import { Users } from 'lucide-react';
import { CandidateCard } from './CandidateCard';
import { CandidateDetailPanel, CandidateDetailPanelData } from './CandidateDetailPanel';

export interface WorkspaceCandidateItem extends CandidateDetailPanelData {
  workflowInfo?: string;
  workflowIcon?: 'document' | 'calendar' | 'checklist' | 'award';
}

export interface HiringCardWorkspaceProps {
  candidates: WorkspaceCandidateItem[];
  emptyMessage?: string;
  pagination?: React.ReactNode;
  renderPanelAction?: (candidate: WorkspaceCandidateItem) => React.ReactNode;
  showDivider?: boolean;
}

export function HiringCardWorkspace({
  candidates,
  emptyMessage = 'No candidates found matching the selected criteria.',
  pagination,
  renderPanelAction,
  showDivider = false,
}: HiringCardWorkspaceProps) {
  // Select first candidate by default if candidates exist
  const [selectedId, setSelectedId] = useState<string | null>(
    candidates.length > 0 ? candidates[0].id : null
  );
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const selectedCandidate = candidates.find((c) => c.id === selectedId) || null;

  const handleSelectCandidate = (candidateId: string) => {
    setSelectedId(candidateId);
    setMobileDrawerOpen(true);
  };

  const handleClosePanel = () => {
    setSelectedId(null);
    setMobileDrawerOpen(false);
  };

  if (candidates.length === 0) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-2xs">
          <Users className="mx-auto h-10 w-10 text-slate-300" />
          <h3 className="mt-3 text-sm font-bold text-slate-900">No Candidates Found</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">{emptyMessage}</p>
        </div>
        {pagination}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Workspace Split Layout: Grid on Left, Sticky Panel on Right */}
      <div
        className={`flex flex-col lg:flex-row ${
          showDivider ? 'items-stretch gap-6 lg:gap-0' : 'items-start gap-6'
        }`}
      >
        {/* Left Side: Candidate Card Grid */}
        <div
          className={`flex-1 w-full min-w-0 ${
            showDivider && selectedCandidate ? 'lg:pr-6' : ''
          }`}
        >
          <div
            className={`grid gap-4 sm:grid-cols-2 ${
              selectedCandidate ? 'xl:grid-cols-2 2xl:grid-cols-3' : 'lg:grid-cols-3'
            }`}
          >
            {candidates.map((c) => (
              <CandidateCard
                key={c.id}
                id={c.id}
                name={c.name}
                position={c.position}
                email={c.email}
                department={c.department}
                appliedDate={c.appliedDate}
                status={c.status}
                statusLabel={c.statusLabel}
                workflowInfo={c.workflowInfo}
                workflowIcon={c.workflowIcon}
                avatarInitials={c.avatarInitials}
                isSelected={c.id === selectedId}
                onSelect={() => handleSelectCandidate(c.id)}
                profileHref={`/dashboard/hiring/applicants/${c.applicationId}`}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          {pagination && <div className="mt-6">{pagination}</div>}
        </div>

        {/* Desktop Vertical Divider */}
        {showDivider && selectedCandidate && (
          <div
            className="hidden lg:block w-px self-stretch bg-[#E2E1DF] shrink-0"
            aria-hidden="true"
          />
        )}

        {/* Right Side: Desktop Candidate Detail Panel */}
        {selectedCandidate && (
          <div
            className={`hidden lg:block w-[360px] xl:w-[400px] shrink-0 ${
              showDivider ? 'lg:pl-6' : 'sticky top-20'
            }`}
          >
            <div className={showDivider ? 'sticky top-20' : ''}>
              <CandidateDetailPanel
                candidate={selectedCandidate}
                onClose={handleClosePanel}
                actionSlot={renderPanelAction ? renderPanelAction(selectedCandidate) : undefined}
              />
            </div>
          </div>
        )}
      </div>

      {/* Mobile / Tablet Slide-over Drawer */}
      {mobileDrawerOpen && selectedCandidate && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer container */}
          <div className="relative ml-auto flex h-full w-full max-w-md flex-col bg-white shadow-xl transition-all p-4">
            <CandidateDetailPanel
              candidate={selectedCandidate}
              onClose={() => setMobileDrawerOpen(false)}
              actionSlot={renderPanelAction ? renderPanelAction(selectedCandidate) : undefined}
            />
          </div>
        </div>
      )}
    </div>
  );
}
