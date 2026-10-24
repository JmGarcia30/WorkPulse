'use client';

import { useState, useTransition, useMemo } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  Search,
  Check,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Plus,
  HeartHandshake,
  Baby,
  Users,
  Stethoscope,
  UserCheck,
  GraduationCap,
} from 'lucide-react';
import {
  configureSagaLeavePolicyAction,
  createLeaveCycleAction,
  createLeaveTypeAction,
  deactivateLeaveTypeAction,
  activateLeaveTypeAction,
  updateLeaveDefaultEntitlementAction,
} from '@/features/leave/hr-actions';
import { EmploymentStatus, LeaveCountingMode } from '@prisma/client';

export interface SettingsType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isPaid: boolean;
  countingMode: LeaveCountingMode | string;
  balanceTracked: boolean;
  defaultGrantUnits: number | null;
  maximumRequestUnits: number | null;
  policyReference?: string | null;
  cycles: Array<{
    id: string;
    code: string;
    name: string;
    startDate: string;
    endDate: string;
  }>;
}

interface LeaveSettingsPanelProps {
  types: SettingsType[];
  organizationName?: string;
  isSagaOrganization?: boolean;
}

function getLeaveTypeIcon(code: string, name: string) {
  const normalized = `${code} ${name}`.toUpperCase();
  if (normalized.includes('BEREAVEMENT')) return HeartHandshake;
  if (normalized.includes('MATERNITY')) return Baby;
  if (normalized.includes('PATERNITY')) return Users;
  if (normalized.includes('SICK') || normalized.includes('PERSONAL')) return Stethoscope;
  if (normalized.includes('SOLO')) return UserCheck;
  if (normalized.includes('STUDY')) return GraduationCap;
  return FileText;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const d = new Date(Date.UTC(year, month, day));
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

export function LeaveSettingsPanel({ types, organizationName, isSagaOrganization = false }: LeaveSettingsPanelProps) {
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Expanded cycle drawer per leave type
  const [expandedCycleTypeId, setExpandedCycleTypeId] = useState<string | null>(null);

  const run = (operation: () => Promise<unknown>, successMsg: string) => {
    startTransition(async () => {
      const result = await operation();
      if (typeof result === 'object' && result !== null && 'error' in result) {
        setFeedback({ type: 'error', message: String(result.error) });
      } else {
        setFeedback({ type: 'success', message: successMsg });
      }
    });
  };

  const handleConfigurePolicy = () => {
    if (!isSagaOrganization) return;
    if (
      !window.confirm(
        'Configure policy definitions and default cycles for the current year? Existing balances and records will not be altered.'
      )
    ) {
      return;
    }
    run(
      () => configureSagaLeavePolicyAction(new Date().getFullYear(), true),
      'Leave policy definitions and cycles configured for current year.'
    );
  };

  const handleCreateLeaveType = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const formElem = event.currentTarget;

    const code = String(form.get('code') || '').trim();
    const name = String(form.get('name') || '').trim();
    const description = String(form.get('description') || '').trim();
    const reference = String(form.get('reference') || '').trim();
    const mode = String(form.get('mode') || 'SCHEDULED_WORK_DAYS') as LeaveCountingMode;
    const grant = form.get('grant') ? Number(form.get('grant')) : null;
    const isPaid = form.get('paid') === 'on';
    const balanceTracked = form.get('tracked') === 'on';

    if (!code || !name || !reference) {
      setFeedback({ type: 'error', message: 'Code, Name, and Policy Reference are required.' });
      return;
    }

    startTransition(async () => {
      const result = await createLeaveTypeAction({
        code,
        name,
        description,
        isPaid,
        countingMode: mode,
        balanceTracked,
        defaultGrantUnits: grant,
        policyReference: reference,
        requiredEmploymentStatus: (String(form.get('employmentStatus') || '') || null) as EmploymentStatus | null,
        minimumServiceMonths: form.get('serviceMonths') ? Number(form.get('serviceMonths')) : null,
        maximumRequestUnits: form.get('maximumUnits') ? Number(form.get('maximumUnits')) : null,
        allowsRetrospectiveFiling: form.get('retrospective') === 'on',
        requiresEligibilityVerification: form.get('eligibility') === 'on',
      });

      if ('error' in result) {
        setFeedback({ type: 'error', message: String(result.error) });
      } else {
        setFeedback({ type: 'success', message: `Leave type "${name}" created successfully.` });
        formElem.reset();
      }
    });
  };

  const handleCreateCycle = (leaveTypeId: string, event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const formElem = event.currentTarget;

    const code = String(form.get('code') || '').trim();
    const name = String(form.get('name') || '').trim();
    const startDate = String(form.get('start') || '');
    const endDate = String(form.get('end') || '');

    if (!code || !name || !startDate || !endDate) {
      setFeedback({ type: 'error', message: 'All cycle fields are required.' });
      return;
    }

    startTransition(async () => {
      const result = await createLeaveCycleAction({
        leaveTypeId,
        code,
        name,
        startDate,
        endDate,
      });

      if ('error' in result) {
        setFeedback({ type: 'error', message: String(result.error) });
      } else {
        setFeedback({ type: 'success', message: `Cycle "${name}" added successfully.` });
        formElem.reset();
      }
    });
  };

  const handleToggleActive = (type: SettingsType) => {
    if (type.isActive) {
      if (!window.confirm(`Deactivate leave type "${type.name}"? New requests under this type will not be allowed.`)) {
        return;
      }
      run(() => deactivateLeaveTypeAction(type.id, true), `Leave type "${type.name}" deactivated.`);
    } else {
      if (!window.confirm(`Reactivate leave type "${type.name}"?`)) {
        return;
      }
      run(() => activateLeaveTypeAction(type.id, true), `Leave type "${type.name}" activated.`);
    }
  };

  // Filtered types
  const filteredTypes = useMemo(() => {
    return types.filter((t) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = t.name.toLowerCase().includes(q);
        const matchesCode = t.code.toLowerCase().includes(q);
        const matchesDesc = (t.description || '').toLowerCase().includes(q);
        if (!matchesName && !matchesCode && !matchesDesc) return false;
      }
      if (statusFilter === 'ACTIVE' && !t.isActive) return false;
      if (statusFilter === 'INACTIVE' && t.isActive) return false;
      return true;
    });
  }, [types, searchQuery, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <Link
          href="/dashboard/leave"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Leave Management</span>
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">Leave Settings / Policies</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Create and manage leave policy definitions and cycles. These settings control leave entitlements and do not directly grant employee balances.
        </p>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          className={`flex items-start gap-3 rounded-xl p-4 text-xs font-medium border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
          )}
          <div className="flex-1">{feedback.message}</div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Section A — Organization Leave Policy */}
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F3F1EC] text-[#756B5D] border border-[#E5E1D9]">
            <FileText className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {organizationName ? `${organizationName} Leave Policy` : 'Organization Leave Policy'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 leading-relaxed max-w-2xl">
              Defines leave types, entitlements, and cycles for {organizationName || 'your organization'}. Update policy settings as needed. Changes will apply to future leave calculations and do not automatically adjust existing employee balances.
            </p>
          </div>
        </div>
        {isSagaOrganization && <button
          type="button"
          disabled={pending}
          onClick={handleConfigurePolicy}
          className="shrink-0 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? 'Configuring...' : 'Configure Current Year'}
        </button>}
      </section>

      {/* Section B — Add Leave Type */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="pb-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Add Leave Type</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Create a new leave type and define its entitlement and cycle settings.
          </p>
        </div>

        <form onSubmit={handleCreateLeaveType} className="mt-5 space-y-4">
          {/* Row 1: Code, Name, Description, Policy Reference */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="leaveCode" className="block text-xs font-semibold text-slate-700">
                Leave Code
              </label>
              <input
                id="leaveCode"
                name="code"
                required
                placeholder="e.g. SICK"
                className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label htmlFor="leaveName" className="block text-xs font-semibold text-slate-700">
                Leave Name
              </label>
              <input
                id="leaveName"
                name="name"
                required
                placeholder="e.g. Sick Leave"
                className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label htmlFor="leaveDescription" className="block text-xs font-semibold text-slate-700">
                Description
              </label>
              <input
                id="leaveDescription"
                name="description"
                placeholder="Brief description of this leave type"
                className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
            <div>
              <label htmlFor="policyReference" className="block text-xs font-semibold text-slate-700">
                Policy Reference
              </label>
              <input
                id="policyReference"
                name="reference"
                required
                placeholder="e.g. Company Policy 1.2"
                className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Row 2: Entitlement Basis, Default Entitlement */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="countingMode" className="block text-xs font-semibold text-slate-700">
                Entitlement Basis
              </label>
              <div className="relative mt-1.5">
                <select
                  id="countingMode"
                  name="mode"
                  defaultValue="SCHEDULED_WORK_DAYS"
                  className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-8 text-xs font-medium text-slate-800 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="SCHEDULED_WORK_DAYS">Scheduled workdays</option>
                  <option value="CALENDAR_DAYS">Calendar days</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
              </div>
            </div>
            <div>
              <label htmlFor="defaultGrant" className="block text-xs font-semibold text-slate-700">
                Default Entitlement (units)
              </label>
              <input
                id="defaultGrant"
                name="grant"
                type="number"
                min="0"
                step="0.0001"
                placeholder="e.g. 5"
                className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <fieldset className="grid gap-4 sm:grid-cols-3">
            <legend className="mb-2 text-xs font-semibold text-slate-700">Eligibility and request limits (optional)</legend>
            <label className="text-xs text-slate-700">Employment classification
              <select name="employmentStatus" className="mt-1 block h-10 w-full rounded-xl border border-slate-200 px-3">
                <option value="">Any classification</option><option value="PROBATIONARY">Probationary</option><option value="REGULAR">Regular</option>
              </select>
            </label>
            <label className="text-xs text-slate-700">Minimum continuous service (months)
              <input name="serviceMonths" type="number" min="0" max="1200" step="1" className="mt-1 block h-10 w-full rounded-xl border border-slate-200 px-3" />
            </label>
            <label className="text-xs text-slate-700">Maximum units per request
              <input name="maximumUnits" type="number" min="0.0001" max="999999.9999" step="0.0001" className="mt-1 block h-10 w-full rounded-xl border border-slate-200 px-3" />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-700"><input name="retrospective" type="checkbox" />Allow retrospective filing</label>
            <label className="flex items-center gap-2 text-xs text-slate-700"><input name="eligibility" type="checkbox" />Require explicit HR eligibility verification</label>
          </fieldset>

          {/* Row 3: Checkboxes & Submit Button */}
          <div className="flex flex-col gap-4 pt-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="paid"
                  defaultChecked
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-800">Paid leave</span>
                  <p className="text-[11px] text-slate-400">This leave type is paid.</p>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="tracked"
                  className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <div>
                  <span className="text-xs font-semibold text-slate-800">Track balance</span>
                  <p className="text-[11px] text-slate-400">Maintain and track employee balance for this leave type.</p>
                </div>
              </label>
            </div>

            <button
              type="submit"
              disabled={pending}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
            >
              {pending ? 'Creating...' : 'Create Leave Type'}
            </button>
          </div>
        </form>
      </section>

      {/* Section C — Leave Types and Cycles */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm space-y-4">
        {/* Header & Filter Toolbar */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Leave Types and Cycles</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Manage existing leave types, their entitlements, and cycle periods.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search leave types..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-52 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              aria-label="Filter by active status"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>

        {/* List of Leave Types */}
        {filteredTypes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-12 text-center">
            <p className="text-sm font-semibold text-slate-700">No leave types found</p>
            <p className="mt-1 text-xs text-slate-400">Try adjusting your search or filter.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTypes.map((type) => {
              const Icon = getLeaveTypeIcon(type.code, type.name);
              const isExpanded = expandedCycleTypeId === type.id;
              const latestCycle = type.cycles[0];

              return (
                <div
                  key={type.id}
                  className="rounded-xl border border-slate-200/80 bg-white transition hover:border-slate-300"
                >
                  {/* Main Row */}
                  <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                    {/* Left: Neutral Icon + Name + Code + Description */}
                    <div className="flex items-start gap-3.5 min-w-0 sm:w-1/3">
                      {/* One cohesive neutral palette across all Leave Type icons */}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F3F1EC] text-[#756B5D] border border-[#E5E1D9]">
                        <Icon className="h-5 w-5" strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-slate-900 text-sm leading-tight truncate">
                          {type.name}
                        </h3>
                        <p className="font-mono text-[11px] text-slate-400 mt-0.5">
                          Code: {type.code}
                        </p>
                        {type.description && (
                          <p className="text-xs text-slate-500 mt-1 line-clamp-1" title={type.description}>
                            {type.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Center: Basis, Default, Badges, Cycle */}
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600 sm:w-1/3">
                      <div>
                        <p className="text-[10px] uppercase font-semibold text-slate-400">Entitlement Basis</p>
                        <p className="font-medium text-slate-800">
                          {type.countingMode === 'SCHEDULED_WORK_DAYS' ? 'Scheduled workdays' : 'Calendar days'}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          {type.isPaid ? (
                            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-100">
                              Paid
                            </span>
                          ) : (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                              Unpaid
                            </span>
                          )}
                          {type.balanceTracked ? (
                            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-100">
                              Balance tracked
                            </span>
                          ) : (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                              Uncounted
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] uppercase font-semibold text-slate-400">Default Grant</p>
                        <p className="font-medium text-slate-800">
                          {type.defaultGrantUnits != null ? `${type.defaultGrantUnits} days` : 'None'}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {latestCycle ? `${latestCycle.name}` : 'No active cycle'}
                        </p>
                      </div>
                    </div>

                    {/* Right: Status badge & Actions */}
                    <div className="flex items-center gap-3 sm:justify-end sm:w-1/3">
                      {/* Status Badge */}
                      {type.isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200/60">
                          <Check className="h-3 w-3" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200/60">
                          Inactive
                        </span>
                      )}

                      {/* Manage Cycles Toggle */}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedCycleTypeId(isExpanded ? null : type.id)
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                      >
                        <span>Cycles ({type.cycles.length})</span>
                        {isExpanded ? (
                          <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                        )}
                      </button>

                      {/* Deactivate / Reactivate button */}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleToggleActive(type)}
                        className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                          type.isActive
                            ? 'border-slate-200 text-rose-600 hover:bg-rose-50'
                            : 'border-slate-200 text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        {type.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>

                  {/* Expandable Cycle Management Drawer */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/50 p-4 rounded-b-xl space-y-4">
                      {!isSagaOrganization && type.balanceTracked && <form onSubmit={event => {
                        event.preventDefault();
                        const amount = Number(new FormData(event.currentTarget).get('entitlement'));
                        run(() => updateLeaveDefaultEntitlementAction({ leaveTypeId: type.id, defaultGrantUnits: amount }), 'Default updated for future grants. Existing ledger grants and balances are unchanged.');
                      }} className="space-y-2">
                        <label className="block text-xs font-semibold text-slate-700">Default entitlement for future grants (units)
                          <input name="entitlement" required type="number" min="0" max="999999.9999" step="0.0001" defaultValue={type.defaultGrantUnits ?? ''} className="ml-2 h-9 rounded-lg border border-slate-200 px-2" />
                        </label>
                        <button disabled={pending} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">Save default entitlement</button>
                        <p className="text-xs text-slate-500">Apply entitlements through <Link href="/dashboard/leave/balances" className="underline">Leave Balances</Link> after configuring a cycle. Each employee receives one default grant per cycle; changing the default does not replace an existing grant.</p>
                      </form>}
                      {/* Existing Cycles */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-700">
                          Configured Cycles for {type.name}
                        </h4>
                        {type.cycles.length === 0 ? (
                          <p className="mt-1 text-xs text-slate-400">
                            No cycles configured yet for this leave type. Add a cycle below.
                          </p>
                        ) : (
                          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {type.cycles.map((cycle) => (
                              <div
                                key={cycle.id}
                                className="flex flex-col justify-between rounded-lg border border-slate-200/80 bg-white p-3 text-xs"
                              >
                                <div>
                                  <p className="font-semibold text-slate-800">{cycle.name}</p>
                                  <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                                    Code: {cycle.code}
                                  </p>
                                </div>
                                <p className="mt-2 text-[11px] font-medium text-slate-500">
                                  {formatDate(cycle.startDate)} – {formatDate(cycle.endDate)}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Add Cycle Form */}
                      <div className="border-t border-slate-200/60 pt-3">
                        <h5 className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Plus className="h-3.5 w-3.5 text-slate-500" />
                          <span>Add New Leave Cycle</span>
                        </h5>
                        <form
                          onSubmit={(e) => handleCreateCycle(type.id, e)}
                          className="mt-2 flex flex-wrap items-center gap-2 text-xs"
                        >
                          <input
                            name="code"
                            required
                            placeholder="Cycle code (e.g. 2027)"
                            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm focus:border-amber-500 focus:outline-none"
                          />
                          <input
                            name="name"
                            required
                            placeholder="Cycle name (e.g. 2027 Calendar Year)"
                            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 placeholder:text-slate-400 shadow-sm focus:border-amber-500 focus:outline-none"
                          />
                          <input
                            name="start"
                            required
                            type="date"
                            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 shadow-sm focus:border-amber-500 focus:outline-none"
                            aria-label="Cycle start date"
                          />
                          <span className="text-slate-400 text-xs">–</span>
                          <input
                            name="end"
                            required
                            type="date"
                            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-800 shadow-sm focus:border-amber-500 focus:outline-none"
                            aria-label="Cycle end date"
                          />
                          <button
                            type="submit"
                            disabled={pending}
                            className="h-8 rounded-lg bg-slate-900 px-3 font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
                          >
                            Add Cycle
                          </button>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
