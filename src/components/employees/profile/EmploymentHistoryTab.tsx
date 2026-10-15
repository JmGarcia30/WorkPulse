import React from 'react';
import { History, Briefcase, Calendar } from 'lucide-react';
import { formatStatusLabel } from '@/lib/ui/format-status';
import type { EmploymentCategory, EmploymentStatus, PayFrequency } from '@prisma/client';

interface EmploymentRecordItem {
  id: string;
  jobTitle: string;
  department: string;
  employmentCategory: EmploymentCategory;
  employmentStatus: EmploymentStatus;
  employmentType: string;
  salary: { toString(): string };
  payFrequency: PayFrequency;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  hireDate: Date;
  createdAt: Date;
}

interface EmploymentHistoryTabProps {
  employmentRecords: EmploymentRecordItem[];
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC',
    dateStyle: 'medium',
  }).format(d);
}

export function EmploymentHistoryTab({ employmentRecords }: EmploymentHistoryTabProps) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4">
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <History className="h-4 w-4 text-slate-500" />
            Employment History Records
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Chronological, effective-dated appointment history and institutional classifications
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
          {employmentRecords.length} {employmentRecords.length === 1 ? 'record' : 'records'}
        </span>
      </div>

      {employmentRecords.length === 0 ? (
        <p className="text-xs text-slate-500 py-3">No employment records found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-3.5 py-2.5">Effective Period</th>
                <th className="px-3 py-2.5">Position</th>
                <th className="px-3 py-2.5">Department</th>
                <th className="px-3 py-2.5">Category</th>
                <th className="px-3 py-2.5">Classification</th>
                <th className="px-3 py-2.5">Type</th>
                <th className="px-3.5 py-2.5 text-right">Appointment Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employmentRecords.map((record, idx) => {
                const isCurrent = idx === 0 && (record.effectiveTo === null || new Date(record.effectiveTo) > new Date());
                return (
                  <tr key={record.id} className="hover:bg-slate-50/60 transition">
                    <td className="px-3.5 py-3 whitespace-nowrap font-medium text-slate-800">
                      <div className="flex items-center gap-2">
                        <span>
                          {formatDate(record.effectiveFrom)} –{' '}
                          {record.effectiveTo ? formatDate(record.effectiveTo) : 'Present'}
                        </span>
                        {isCurrent && (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.2 text-[10px] font-bold text-emerald-700 border border-emerald-200/60">
                            Current
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-900 whitespace-nowrap">
                      {record.jobTitle}
                    </td>
                    <td className="px-3 py-3 text-slate-700 whitespace-nowrap">
                      {record.department || '—'}
                    </td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                      {formatStatusLabel(record.employmentCategory)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap font-medium text-slate-700">
                      {formatStatusLabel(record.employmentStatus)}
                    </td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">
                      {record.employmentType}
                    </td>
                    <td className="px-3.5 py-3 text-right font-mono text-slate-800 whitespace-nowrap">
                      ₱{record.salary.toString()} <span className="text-[10px] text-slate-400">({record.payFrequency})</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
