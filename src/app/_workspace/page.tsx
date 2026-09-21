import { WorkspaceDiscoveryForm } from '@/components/public/WorkspaceDiscoveryForm';

export default function WorkspaceDiscoveryPage() {
  return <main className="wp-public-shell flex min-h-screen items-center justify-center px-5 py-16"><section className="w-full max-w-lg border-t-4 border-[var(--wp-brand)] bg-[var(--wp-surface)] px-6 py-10 shadow-sm sm:px-10"><p className="wp-eyebrow">WorkPulse workspace</p><h1 className="wp-page-title mt-3">Find your organization</h1><p className="mt-3 max-w-md text-sm leading-6 text-[var(--wp-text-muted)]">Enter the workspace name supplied by your organization. We’ll take you to its secure WorkPulse sign-in page.</p><WorkspaceDiscoveryForm /></section></main>;
}
