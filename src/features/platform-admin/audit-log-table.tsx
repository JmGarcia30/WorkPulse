'use client';

import { useMemo, useState } from 'react';

export type SafeAuditRow = {
  timestamp: string;
  organization: string;
  actor: string;
  module: string;
  action: string;
  recordType: string;
  outcome: string;
  description: string;
  reference: string;
};

const PAGE_SIZE = 20;
export function PlatformAuditLogTable({ rows }: { rows: SafeAuditRow[] }) {
  const [module, setModule] = useState('all');
  const [outcome, setOutcome] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const modules = useMemo(() => [...new Set(rows.map(row => row.module))].sort(), [rows]);
  const filtered = useMemo(() => rows.filter(row =>
    (module === 'all' || row.module === module) &&
    (outcome === 'all' || row.outcome === outcome) &&
    (query.trim() === '' || [row.organization, row.action, row.module, row.recordType].some(value => value.toLowerCase().includes(query.trim().toLowerCase())))
  ), [rows, module, outcome, query]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  return <div className="space-y-4">
    <form className="grid gap-3 md:grid-cols-3" onSubmit={event => event.preventDefault()}>
      <label className="grid gap-1 text-sm">Search organization or action
        <input className="wp-input" type="search" value={query} placeholder="Search latest records" onChange={event => { setQuery(event.target.value); setPage(1); }}/>
      </label>
      <label className="grid gap-1 text-sm">Module
        <select className="wp-input" value={module} onChange={event => { setModule(event.target.value); setPage(1); }}>
          <option value="all">All modules</option>{modules.map(value => <option key={value} value={value}>{value}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm">Outcome
        <select className="wp-input" value={outcome} onChange={event => { setOutcome(event.target.value); setPage(1); }}>
          <option value="all">All outcomes</option><option value="Success">Success</option><option value="Failure">Failure</option>
        </select>
      </label>
    </form>
    <p className="text-sm text-slate-600">Showing {visible.length} of {filtered.length} matching events within the latest {rows.length} recorded events. Older history is not included in this view.</p>
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full min-w-[1000px] text-left text-xs">
        <caption className="sr-only">Platform audit event metadata</caption>
        <thead><tr>{['Date / time', 'Organization', 'Module', 'Action', 'Outcome', 'Actor (masked)', 'Record type'].map(label =>
          <th key={label} className="p-3" scope="col">{label}</th>)}</tr></thead>
        <tbody>{visible.map(row => <tr key={row.reference + row.module + row.timestamp} className="border-t align-top">
          <td className="p-3 whitespace-nowrap">{row.timestamp}</td><td className="p-3">{row.organization}</td><td className="p-3">{row.module}</td>
          <td className="p-3">{row.action}</td><td className="p-3">{row.outcome}</td><td className="p-3 font-mono">{row.actor}</td><td className="p-3">{row.recordType}</td>
        </tr>)}</tbody>
      </table>{visible.length === 0 && <p className="p-4 text-sm">No audit events match your filters.</p>}
    </div>
    <nav aria-label="Audit pages" className="flex items-center gap-3 text-sm">
      <button type="button" className="wp-button-secondary" disabled={current <= 1} onClick={() => setPage(current - 1)}>Previous</button>
      <span>Page {current} of {totalPages}</span>
      <button type="button" className="wp-button-secondary" disabled={current >= totalPages} onClick={() => setPage(current + 1)}>Next</button>
    </nav>
  </div>;
}
