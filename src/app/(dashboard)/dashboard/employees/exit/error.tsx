'use client';

export default function ExitError({ reset }: { reset: () => void }) {
  return <div role="alert" className="rounded-xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-semibold">Exit Management is unavailable</h2><p className="my-3 text-sm">Check your access and connection. An administrator must apply the H10 migrations before using this module.</p><button onClick={reset} className="rounded-md border px-4 py-2 text-sm">Try again</button></div>;
}
