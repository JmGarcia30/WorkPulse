import Link from 'next/link';
import type { ReactNode } from 'react';

export function MetricStrip({ items }: { items: Array<{ label: string; value: string | number; helper: string; href: string }> }) {
  return <div className={`grid gap-px overflow-hidden rounded-lg border border-[var(--wp-border)] bg-[var(--wp-border)] sm:grid-cols-2 ${items.length <= 2 ? 'xl:grid-cols-2' : items.length === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-4'}`}>
    {items.map(item => <Link key={item.label} href={item.href} className="wp-metric">
      <p className="text-sm font-medium text-[var(--wp-text-muted)]">{item.label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{item.value}</p>
      <p className="mt-1 text-sm text-[var(--wp-text-muted)]">{item.helper}</p>
    </Link>)}
  </div>;
}

export function WorkspacePanel({ title, description, href, children }: { title: string; description?: string; href?: string; children: ReactNode }) {
  return <section className="wp-card p-5">
    <div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="wp-section-title">{title}</h2>{description && <p className="mt-1 text-sm text-[var(--wp-text-muted)]">{description}</p>}</div>{href && <Link href={href} className="shrink-0 py-1 text-sm font-semibold text-[var(--tenant-primary)] hover:underline">View all</Link>}</div>
    {children}
  </section>;
}
