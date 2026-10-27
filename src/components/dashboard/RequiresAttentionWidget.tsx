'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, ArrowRight, CheckCircle2 } from 'lucide-react';
import { AttentionItemDetail } from '@/features/dashboard/read-model';

interface RequiresAttentionWidgetProps {
  items: AttentionItemDetail[];
}

export function RequiresAttentionWidget({ items }: RequiresAttentionWidgetProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Available categories in the current items
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(i.category));
    return ['ALL', ...Array.from(set)];
  }, [items]);

  // Filter items by search query and category
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesCategory =
        selectedCategory === 'ALL' || item.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.employeeOrCandidate.toLowerCase().includes(q) ||
        item.actionRequired.toLowerCase().includes(q) ||
        (item.departmentOrRole && item.departmentOrRole.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [items, searchQuery, selectedCategory]);

  const getStatusBadge = (status: string, variant: AttentionItemDetail['statusVariant']) => {
    switch (variant) {
      case 'danger':
        return 'bg-rose-50 text-rose-700';
      case 'warning':
        return 'bg-amber-50 text-amber-800';
      case 'info':
        return 'bg-blue-50 text-blue-700';
      case 'pending':
        return 'bg-purple-50 text-purple-700';
      default:
        return 'bg-slate-100 text-[#282934]';
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <div className="flex flex-col justify-between rounded-2xl bg-white p-5 shadow-[0_3px_16px_rgba(30,35,40,0.06)] h-full">
      {/* Top Header & Search / Filter Controls */}
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-[#282934] tracking-tight">
                Requires Attention
              </h2>
              <span className="inline-flex items-center justify-center rounded-[6px] bg-rose-50 px-[7px] py-[3px] text-[11px] font-bold text-rose-700 tabular-nums leading-none">
                {items.length}
              </span>
            </div>
            <p className="text-xs text-[#777882] font-medium">
              Outstanding leave approvals, probation reviews, and hiring actions
            </p>
          </div>

          {/* Search bar and Category filter */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#C7A759]" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-36 sm:w-48 rounded-xl border border-slate-200 bg-slate-50/50 pl-8 pr-3 text-xs text-[#282934] placeholder-[#777882] focus:bg-white focus:border-[#C7A759] focus:outline-none transition-colors"
              />
            </div>

            <div className="relative">
              <select
                aria-label="Filter items by category"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-8 rounded-xl border border-slate-200 bg-slate-50/50 px-2.5 text-xs font-medium text-[#282934] focus:bg-white focus:border-[#C7A759] focus:outline-none cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === 'ALL' ? 'All Categories' : c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table layout matching the reference image's clean aesthetic */}
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[#777882] font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 pr-2 w-8">SL.</th>
                <th className="py-2.5 px-3">Employee / Candidate</th>
                <th className="py-2.5 px-3">Action Required</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3">Due Date</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 pl-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#777882]">
                    <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-500 mb-1.5" />
                    <p className="text-sm font-semibold text-[#282934]">
                      No items require attention
                    </p>
                    <p className="text-xs text-[#777882] mt-0.5">
                      {searchQuery
                        ? 'No actions matched your search criteria.'
                        : 'All queues are up to date and cleared.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredItems.slice(0, 10).map((item, index) => {
                  const sl = String(index + 1).padStart(2, '0');
                  const initials = getInitials(item.employeeOrCandidate);
                  const badgeClass = getStatusBadge(item.status, item.statusVariant);

                  return (
                    <tr
                      key={item.id}
                      className="group hover:bg-slate-50/60 transition-colors"
                    >
                      {/* SL. */}
                      <td className="py-3 pr-2 font-mono text-[11px] text-[#777882]">
                        {sl}
                      </td>

                      {/* Employee / Candidate with Avatar Badge */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-[#282934] group-hover:bg-slate-200 transition-colors">
                            {initials}
                          </span>
                          <div className="min-w-0">
                            <div className="font-bold text-[#282934] truncate">
                              {item.employeeOrCandidate}
                            </div>
                            {item.departmentOrRole && (
                              <div className="text-[11px] text-[#777882] truncate">
                                {item.departmentOrRole}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Action Required */}
                      <td className="py-3 px-3">
                        <span className="font-medium text-[#282934] line-clamp-1">
                          {item.actionRequired}
                        </span>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center justify-center rounded-[6px] bg-[#E8E5DF]/60 px-[7px] py-[3px] text-[11px] font-semibold text-[#62636B] leading-none">
                          {item.category}
                        </span>
                      </td>

                      {/* Due Date */}
                      <td className="py-3 px-3 whitespace-nowrap text-[#62636B] tabular-nums">
                        {item.dueDate}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center justify-center rounded-[6px] px-[7px] py-[3px] text-[10px] font-semibold leading-none ${badgeClass}`}
                        >
                          {item.status}
                        </span>
                      </td>

                      {/* View Action link */}
                      <td className="py-3 pl-3 text-right whitespace-nowrap">
                        <Link
                          href={item.href}
                          className="inline-flex items-center gap-1 font-semibold text-[#282934] hover:text-[#C7A759] hover:underline"
                        >
                          Review
                          <ArrowRight className="h-3 w-3 text-[#C7A759]" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer link to full queue */}
      {filteredItems.length > 10 && (
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-[#62636B]">
          <span>Showing 10 of {filteredItems.length} pending items</span>
          <Link
            href="/dashboard/employees?needsReview=1"
            className="font-semibold text-[#282934] hover:text-[#C7A759]"
          >
            View All Reviews →
          </Link>
        </div>
      )}
    </div>
  );
}
