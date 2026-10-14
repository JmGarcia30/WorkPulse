'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Scale,
  Settings,
  FileText,
  Check,
  X,
  Calendar,
  MoreVertical,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  MinusCircle,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  CalendarCheck,
} from 'lucide-react';
import { LeaveAdminOverviewData } from '@/features/leave/hr-queries';

interface LeaveDashboardViewProps {
  data: LeaveAdminOverviewData;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDateDisplay(dateStr: string): string {
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

function formatDateRange(from: string, to: string): string {
  if (!from) return '—';
  if (!to || from === to) return formatDateDisplay(from);
  return `${formatDateDisplay(from)} – ${formatDateDisplay(to)}`;
}

export function LeaveDashboardView({ data }: LeaveDashboardViewProps) {
  const { summary, upcomingApproved, activityData, leaveTypes, pendingRequests, allRequests } = data;

  // View switch for Leave Activity (Weekly vs Monthly)
  const [activityView, setActivityView] = useState<'weekly' | 'monthly'>('weekly');

  // Filters for Pending Approvals
  const [pendingSearch, setPendingSearch] = useState('');
  const [pendingTypeFilter, setPendingTypeFilter] = useState('');
  const [pendingDateFilter, setPendingDateFilter] = useState('ALL');
  const [pendingPage, setPendingPage] = useState(1);
  const pendingPageSize = 5;

  // Selected checkboxes for Pending Approvals
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);

  // Filters for All Leave Requests
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('ALL');
  const [historyTypeFilter, setHistoryTypeFilter] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState('ALL');
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 10;

  // Selected checkboxes for All Requests
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);

  // Filtered Pending Requests
  const filteredPending = useMemo(() => {
    return pendingRequests.filter((req) => {
      if (pendingSearch.trim()) {
        const query = pendingSearch.toLowerCase();
        const matchesName = req.employeeName.toLowerCase().includes(query);
        const matchesNum = req.employee.employeeNumber.toLowerCase().includes(query);
        if (!matchesName && !matchesNum) return false;
      }
      if (pendingTypeFilter && req.type !== pendingTypeFilter && req.typeCode !== pendingTypeFilter) {
        return false;
      }
      if (pendingDateFilter !== 'ALL') {
        const todayStr = data.today;
        if (pendingDateFilter === 'THIS_MONTH' && !req.from.startsWith(todayStr.slice(0, 7))) {
          return false;
        }
      }
      return true;
    });
  }, [pendingRequests, pendingSearch, pendingTypeFilter, pendingDateFilter, data.today]);

  // Paginated Pending Requests
  const totalPendingPages = Math.max(1, Math.ceil(filteredPending.length / pendingPageSize));
  const currentPendingPage = Math.min(pendingPage, totalPendingPages);
  const paginatedPending = useMemo(() => {
    const start = (currentPendingPage - 1) * pendingPageSize;
    return filteredPending.slice(start, start + pendingPageSize);
  }, [filteredPending, currentPendingPage, pendingPageSize]);

  // Filtered History Requests
  const filteredHistory = useMemo(() => {
    return allRequests.filter((req) => {
      if (historySearch.trim()) {
        const query = historySearch.toLowerCase();
        const matchesName = req.employeeName.toLowerCase().includes(query);
        const matchesNum = req.employee.employeeNumber.toLowerCase().includes(query);
        if (!matchesName && !matchesNum) return false;
      }
      if (historyStatusFilter !== 'ALL') {
        if (historyStatusFilter === 'CLOSED') {
          if (!['REJECTED', 'CANCELLED', 'WITHDRAWN'].includes(req.status)) return false;
        } else if (req.status !== historyStatusFilter) {
          return false;
        }
      }
      if (historyTypeFilter && req.type !== historyTypeFilter && req.typeCode !== historyTypeFilter) {
        return false;
      }
      if (historyDateFilter !== 'ALL') {
        const todayStr = data.today;
        if (historyDateFilter === 'THIS_MONTH' && !req.from.startsWith(todayStr.slice(0, 7))) {
          return false;
        }
      }
      return true;
    });
  }, [allRequests, historySearch, historyStatusFilter, historyTypeFilter, historyDateFilter, data.today]);

  // Paginated History Requests
  const totalHistoryPages = Math.max(1, Math.ceil(filteredHistory.length / historyPageSize));
  const currentHistoryPage = Math.min(historyPage, totalHistoryPages);
  const paginatedHistory = useMemo(() => {
    const start = (currentHistoryPage - 1) * historyPageSize;
    return filteredHistory.slice(start, start + historyPageSize);
  }, [filteredHistory, currentHistoryPage, historyPageSize]);

  // Activity chart data
  const currentActivityData = activityView === 'weekly' ? activityData.weekly : activityData.monthly;
  const maxBarValue = Math.max(
    ...currentActivityData.map((d) => d.approved + d.pending),
    8
  );
  // Round up maxBarValue to even number for nice ticks
  const chartMax = maxBarValue % 2 === 0 ? maxBarValue : maxBarValue + 1;
  const yTicks = [chartMax, Math.round(chartMax * 0.8), Math.round(chartMax * 0.6), Math.round(chartMax * 0.4), Math.round(chartMax * 0.2), 0];

  // Selection handlers
  const toggleSelectAllPending = () => {
    if (selectedPendingIds.length === paginatedPending.length) {
      setSelectedPendingIds([]);
    } else {
      setSelectedPendingIds(paginatedPending.map((r) => r.id));
    }
  };

  const toggleSelectPending = (id: string) => {
    setSelectedPendingIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllHistory = () => {
    if (selectedHistoryIds.length === paginatedHistory.length) {
      setSelectedHistoryIds([]);
    } else {
      setSelectedHistoryIds(paginatedHistory.map((r) => r.id));
    }
  };

  const toggleSelectHistory = (id: string) => {
    setSelectedHistoryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Leave Management</h1>
          <p className="mt-0.5 text-sm text-slate-500">Operational leave review and approval</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/leave/balances"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
          >
            <Scale className="h-4 w-4 text-slate-500" />
            <span>Balances</span>
          </Link>
          <Link
            href="/dashboard/leave/settings"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
          >
            <Settings className="h-4 w-4 text-slate-500" />
            <span>Settings / Policies</span>
          </Link>
        </div>
      </div>

      {/* 2. Summary Cards Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Pending Requests */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-start justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-100/70">
              <FileText className="h-5 w-5" />
            </div>
            <button
              type="button"
              className="text-slate-400 hover:text-slate-600"
              aria-label="Options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500">Pending Requests</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              {summary.pending}
            </p>
            <p className="mt-1 text-xs text-slate-400">For review and approval</p>
          </div>
        </div>

        {/* Approved This Month */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-start justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100/70">
              <Check className="h-5 w-5" />
            </div>
            <button
              type="button"
              className="text-slate-400 hover:text-slate-600"
              aria-label="Options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500">Approved This Month</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              {summary.approvedThisMonth}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {summary.approvedDiff > 0
                ? `+${summary.approvedDiff} from last month`
                : summary.approvedDiff < 0
                ? `${summary.approvedDiff} from last month`
                : 'Current cycle'}
            </p>
          </div>
        </div>

        {/* Rejected / Cancelled */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-start justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100/70">
              <X className="h-5 w-5" />
            </div>
            <button
              type="button"
              className="text-slate-400 hover:text-slate-600"
              aria-label="Options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500">Rejected / Cancelled</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              {summary.rejectedCancelled}
            </p>
            <p className="mt-1 text-xs text-slate-400">This month</p>
          </div>
        </div>

        {/* Employees on Leave Today */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-start justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 border border-slate-200/60">
              <Calendar className="h-5 w-5" />
            </div>
            <button
              type="button"
              className="text-slate-400 hover:text-slate-600"
              aria-label="Options"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-slate-500">Employees on Leave Today</p>
            <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              {summary.onLeaveToday}
            </p>
            <p className="mt-1 text-xs text-slate-400">Currently on approved leave</p>
          </div>
        </div>
      </div>

      {/* 3 & 4. Leave Activity & Upcoming Leaves */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Leave Activity / Trend Panel */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm lg:col-span-6 xl:col-span-6">
          <div>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Leave Activity</h2>
                <p className="text-xs text-slate-500">Approved leave requests per day</p>
              </div>
              <select
                value={activityView}
                onChange={(e) => setActivityView(e.target.value as 'weekly' | 'monthly')}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                aria-label="Select activity range"
              >
                <option value="weekly">Weekly View</option>
                <option value="monthly">Monthly View</option>
              </select>
            </div>

            {/* Chart Area */}
            <div className="mt-6">
              <div className="relative flex h-52 w-full gap-2 pt-2">
                {/* Y-axis Ticks */}
                <div className="flex flex-col justify-between pr-2 text-right text-[10px] font-semibold text-slate-400">
                  {yTicks.map((val) => (
                    <span key={val} className="leading-none">
                      {val}
                    </span>
                  ))}
                </div>

                {/* Bars Container */}
                <div className="relative flex flex-1 items-end justify-between border-b border-l border-slate-100 px-2 pb-1">
                  {/* Subtle Gridlines */}
                  <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                    {yTicks.map((val) => (
                      <div key={val} className="w-full border-b border-slate-100/60" />
                    ))}
                  </div>

                  {currentActivityData.map((d) => {
                    const totalVal = d.approved + d.pending;
                    const approvedHeightPct = (d.approved / chartMax) * 100;
                    const pendingHeightPct = (d.pending / chartMax) * 100;

                    return (
                      <div
                        key={d.date}
                        className="group relative z-10 flex h-full flex-col justify-end items-center"
                        style={{ width: activityView === 'weekly' ? '12%' : '2.5%' }}
                      >
                        {/* Tooltip */}
                        <div className="pointer-events-none absolute -top-12 left-1/2 z-30 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg group-hover:block">
                          <p>{d.label}</p>
                          <p className="text-[10px] text-slate-300">
                            Approved: {d.approved} · Pending: {d.pending}
                          </p>
                        </div>

                        {/* Stacked Bar */}
                        <div className="flex w-full flex-col justify-end transition-all duration-300">
                          {d.pending > 0 && (
                            <div
                              style={{ height: `${pendingHeightPct}%` }}
                              className="w-full rounded-t-sm bg-amber-200/90 transition-all hover:bg-amber-300"
                            />
                          )}
                          {d.approved > 0 && (
                            <div
                              style={{ height: `${approvedHeightPct}%` }}
                              className={`w-full bg-amber-600 transition-all hover:bg-amber-700 ${
                                d.pending === 0 ? 'rounded-t-sm' : ''
                              }`}
                            />
                          )}
                          {totalVal === 0 && (
                            <div className="h-1 w-full rounded-full bg-slate-100" />
                          )}
                        </div>

                        {/* X-axis Label (condensed for monthly) */}
                        {activityView === 'weekly' ? (
                          <span className="mt-2 text-[11px] font-medium text-slate-500 whitespace-nowrap">
                            {d.label}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              {activityView === 'monthly' && (
                <div className="mt-2 flex justify-between px-8 text-[11px] text-slate-400">
                  <span>{currentActivityData[0]?.label}</span>
                  <span>{currentActivityData[Math.floor(currentActivityData.length / 2)]?.label}</span>
                  <span>{currentActivityData[currentActivityData.length - 1]?.label}</span>
                </div>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center justify-center gap-6 border-t border-slate-100 pt-3 text-xs font-medium text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-600" />
              <span>Approved</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-200" />
              <span>Pending</span>
            </div>
          </div>
        </div>

        {/* Upcoming Leaves Panel */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm lg:col-span-6 xl:col-span-6">
          <div>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Upcoming Leaves</h2>
                <p className="text-xs text-slate-500">Approved leave requests in the next 30 days</p>
              </div>
              <Link
                href="/dashboard/attendance"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                <span>View Calendar</span>
              </Link>
            </div>

            {/* Table of Upcoming Approved Leaves */}
            <div className="mt-4 overflow-x-auto">
              {upcomingApproved.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400">
                    <CalendarCheck className="h-6 w-6" />
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-700">No upcoming approved leaves</p>
                  <p className="mt-1 text-xs text-slate-400">
                    Approved requests scheduled for the next 30 days will appear here.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500">
                      <th className="pb-2.5 font-semibold">Employee</th>
                      <th className="pb-2.5 font-semibold">Leave Type</th>
                      <th className="pb-2.5 font-semibold">From – To</th>
                      <th className="pb-2.5 text-right font-semibold">No. of Days</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {upcomingApproved.map((req) => (
                      <tr key={req.id} className="transition hover:bg-slate-50/70">
                        <td className="py-3 pr-2">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-700">
                              {getInitials(req.employeeName)}
                            </span>
                            <span className="font-semibold text-slate-800">{req.employeeName}</span>
                          </div>
                        </td>
                        <td className="py-3 text-slate-600">{req.type}</td>
                        <td className="py-3 text-slate-600 whitespace-nowrap">
                          {formatDateRange(req.from, req.to)}
                        </td>
                        <td className="py-3 text-right font-semibold text-slate-800">
                          {req.units != null ? `${req.units} day${req.units === 1 ? '' : 's'}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Pending Approvals Section */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Pending Approvals</h2>
              <span className="inline-flex h-5 items-center justify-center rounded-full bg-amber-100 px-2 text-xs font-bold text-amber-800">
                {pendingRequests.length}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Leave requests awaiting your review and approval.
            </p>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by employee name..."
                value={pendingSearch}
                onChange={(e) => {
                  setPendingSearch(e.target.value);
                  setPendingPage(1);
                }}
                className="h-9 w-56 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <select
              value={pendingTypeFilter}
              onChange={(e) => {
                setPendingTypeFilter(e.target.value);
                setPendingPage(1);
              }}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              aria-label="Filter by leave type"
            >
              <option value="">All Leave Types</option>
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>

            <select
              value={pendingDateFilter}
              onChange={(e) => {
                setPendingDateFilter(e.target.value);
                setPendingPage(1);
              }}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              aria-label="Filter by date range"
            >
              <option value="ALL">Date Range</option>
              <option value="THIS_MONTH">This Month</option>
            </select>

            {(pendingSearch || pendingTypeFilter || pendingDateFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setPendingSearch('');
                  setPendingTypeFilter('');
                  setPendingDateFilter('ALL');
                  setPendingPage(1);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <Filter className="h-3 w-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Pending Table */}
        <div className="mt-4 overflow-x-auto">
          {filteredPending.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-700">No pending leave requests</p>
              <p className="mt-1 text-xs text-slate-400">
                All submitted leave requests have been reviewed and processed.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/50 text-slate-600">
                  <th className="p-3 w-10">
                    <input
                      type="checkbox"
                      checked={
                        paginatedPending.length > 0 &&
                        selectedPendingIds.length === paginatedPending.length
                      }
                      onChange={toggleSelectAllPending}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                      aria-label="Select all pending requests on this page"
                    />
                  </th>
                  <th className="p-3 font-semibold">Employee</th>
                  <th className="p-3 font-semibold">Leave Type</th>
                  <th className="p-3 font-semibold">From – To</th>
                  <th className="p-3 font-semibold">No. of Days</th>
                  <th className="p-3 font-semibold">Reason</th>
                  <th className="p-3 font-semibold">Date Filed</th>
                  <th className="p-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedPending.map((req) => {
                  const isSelected = selectedPendingIds.includes(req.id);
                  return (
                    <tr
                      key={req.id}
                      className={`transition hover:bg-slate-50/70 ${
                        isSelected ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectPending(req.id)}
                          className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                          aria-label={`Select request from ${req.employeeName}`}
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-700">
                            {getInitials(req.employeeName)}
                          </span>
                          <div>
                            <p className="font-semibold text-slate-900">{req.employeeName}</p>
                            <p className="text-[11px] text-slate-400">
                              {req.employee.employeeNumber}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-slate-700 font-medium">{req.type}</td>
                      <td className="p-3 text-slate-600 whitespace-nowrap">
                        {formatDateRange(req.from, req.to)}
                      </td>
                      <td className="p-3 font-semibold text-slate-800">
                        {req.units != null ? `${req.units} day${req.units === 1 ? '' : 's'}` : 'Pending calculation'}
                      </td>
                      <td className="p-3 text-slate-600 max-w-xs truncate" title={req.reason}>
                        {req.reason || '—'}
                      </td>
                      <td className="p-3 text-slate-600 whitespace-nowrap">
                        {formatDateDisplay(req.submittedAt)}
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={`/dashboard/leave/requests/${req.id}`}
                            className="rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm transition hover:bg-slate-50"
                          >
                            Review
                          </Link>
                          <button
                            type="button"
                            className="rounded p-1 text-slate-400 hover:text-slate-600"
                            aria-label="More actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pending Pagination Footer */}
        {filteredPending.length > 0 && (
          <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row text-xs text-slate-500">
            <p>
              Showing{' '}
              <span className="font-semibold text-slate-700">
                {(currentPendingPage - 1) * pendingPageSize + 1}
              </span>
              –
              <span className="font-semibold text-slate-700">
                {Math.min(currentPendingPage * pendingPageSize, filteredPending.length)}
              </span>{' '}
              of <span className="font-semibold text-slate-700">{filteredPending.length}</span>{' '}
              requests
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPendingPage <= 1}
                onClick={() => setPendingPage((p) => Math.max(1, p - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPendingPages }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPendingPage(num)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold ${
                    num === currentPendingPage
                      ? 'border-amber-600 bg-amber-600 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                disabled={currentPendingPage >= totalPendingPages}
                onClick={() => setPendingPage((p) => Math.min(totalPendingPages, p + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 6. All Leave Requests / History Section */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">All Leave Requests</h2>
            <p className="mt-0.5 text-xs text-slate-500">Complete leave request history.</p>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by employee name..."
                value={historySearch}
                onChange={(e) => {
                  setHistorySearch(e.target.value);
                  setHistoryPage(1);
                }}
                className="h-9 w-52 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            <select
              value={historyStatusFilter}
              onChange={(e) => {
                setHistoryStatusFilter(e.target.value);
                setHistoryPage(1);
              }}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              aria-label="Filter by status"
            >
              <option value="ALL">All Statuses</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            <select
              value={historyTypeFilter}
              onChange={(e) => {
                setHistoryTypeFilter(e.target.value);
                setHistoryPage(1);
              }}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              aria-label="Filter by leave type"
            >
              <option value="">All Leave Types</option>
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>

            <select
              value={historyDateFilter}
              onChange={(e) => {
                setHistoryDateFilter(e.target.value);
                setHistoryPage(1);
              }}
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              aria-label="Filter by date range"
            >
              <option value="ALL">Date Range</option>
              <option value="THIS_MONTH">This Month</option>
            </select>

            {(historySearch ||
              historyStatusFilter !== 'ALL' ||
              historyTypeFilter ||
              historyDateFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setHistorySearch('');
                  setHistoryStatusFilter('ALL');
                  setHistoryTypeFilter('');
                  setHistoryDateFilter('ALL');
                  setHistoryPage(1);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <Filter className="h-3 w-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* History Table */}
        <div className="mt-4 overflow-x-auto">
          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-12 text-center">
              <p className="text-sm font-semibold text-slate-700">No leave requests found</p>
              <p className="mt-1 text-xs text-slate-400">
                Try adjusting your search query or filters.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/50 text-slate-600">
                  <th className="p-3 w-10">
                    <input
                      type="checkbox"
                      checked={
                        paginatedHistory.length > 0 &&
                        selectedHistoryIds.length === paginatedHistory.length
                      }
                      onChange={toggleSelectAllHistory}
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                      aria-label="Select all requests on this page"
                    />
                  </th>
                  <th className="p-3 font-semibold">Employee</th>
                  <th className="p-3 font-semibold">Leave Type</th>
                  <th className="p-3 font-semibold">From – To</th>
                  <th className="p-3 font-semibold">No. of Days</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold">Date Filed</th>
                  <th className="p-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedHistory.map((req) => {
                  const isSelected = selectedHistoryIds.includes(req.id);
                  return (
                    <tr
                      key={req.id}
                      className={`transition hover:bg-slate-50/70 ${
                        isSelected ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectHistory(req.id)}
                          className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                          aria-label={`Select request from ${req.employeeName}`}
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-700">
                            {getInitials(req.employeeName)}
                          </span>
                          <div>
                            <p className="font-semibold text-slate-900">{req.employeeName}</p>
                            <p className="text-[11px] text-slate-400">
                              {req.employee.employeeNumber}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-slate-700 font-medium">{req.type}</td>
                      <td className="p-3 text-slate-600 whitespace-nowrap">
                        {formatDateRange(req.from, req.to)}
                      </td>
                      <td className="p-3 font-semibold text-slate-800">
                        {req.units != null ? `${req.units} day${req.units === 1 ? '' : 's'}` : '—'}
                      </td>
                      <td className="p-3">
                        {req.status === 'APPROVED' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200/60">
                            <Check className="h-3 w-3" />
                            <span>Approved</span>
                          </span>
                        )}
                        {req.status === 'REJECTED' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 border border-rose-200/60">
                            <X className="h-3 w-3" />
                            <span>Rejected</span>
                          </span>
                        )}
                        {req.status === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200/60">
                            <Clock className="h-3 w-3" />
                            <span>Pending</span>
                          </span>
                        )}
                        {['CANCELLED', 'WITHDRAWN'].includes(req.status) && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200/60">
                            <MinusCircle className="h-3 w-3" />
                            <span>{req.status === 'CANCELLED' ? 'Cancelled' : 'Withdrawn'}</span>
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-600 whitespace-nowrap">
                        {formatDateDisplay(req.submittedAt)}
                      </td>
                      <td className="p-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={`/dashboard/leave/requests/${req.id}`}
                            className="rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 shadow-sm transition hover:bg-slate-50"
                          >
                            View
                          </Link>
                          <button
                            type="button"
                            className="rounded p-1 text-slate-400 hover:text-slate-600"
                            aria-label="More actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* History Pagination Footer */}
        {filteredHistory.length > 0 && (
          <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row text-xs text-slate-500">
            <p>
              Showing{' '}
              <span className="font-semibold text-slate-700">
                {(currentHistoryPage - 1) * historyPageSize + 1}
              </span>
              –
              <span className="font-semibold text-slate-700">
                {Math.min(currentHistoryPage * historyPageSize, filteredHistory.length)}
              </span>{' '}
              of <span className="font-semibold text-slate-700">{filteredHistory.length}</span>{' '}
              requests
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentHistoryPage <= 1}
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalHistoryPages }, (_, i) => i + 1).map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setHistoryPage(num)}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs font-semibold ${
                    num === currentHistoryPage
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                disabled={currentHistoryPage >= totalHistoryPages}
                onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
