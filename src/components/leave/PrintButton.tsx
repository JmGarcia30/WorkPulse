'use client';

export function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="no-print rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white">Print Leave Form</button>;
}
