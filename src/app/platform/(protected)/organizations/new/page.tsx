import Link from 'next/link';
import { randomUUID } from 'node:crypto';
import { ArrowLeft, Building2, ShieldCheck } from 'lucide-react';
import { requirePlatformAdministrator } from '@/features/platform-admin/session';
import { CreateOrganizationForm } from '@/features/platform-admin/onboarding-forms';

export default async function CreateOrganizationPage() {
  await requirePlatformAdministrator();
  return <div className="platform-section-gap">
    <Link href="/platform/organizations" className="platform-page-back"><ArrowLeft size={14}/> Back to organizations</Link>
    <div><p className="platform-eyebrow">New workspace</p><h1 className="platform-title">Create organization</h1><p className="platform-description">Register a new tenant and invite its initial HR administrator. New workspaces start with career portals disabled.</p></div>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(270px,.7fr)]">
      <section className="platform-card p-6">
        <div className="mb-6 flex items-center gap-3"><div className="platform-stat-icon"><Building2 size={19}/></div><div><h2 className="platform-card-title">Organization details</h2><p className="platform-card-description">Enter verified information for the new workspace.</p></div></div>
        <CreateOrganizationForm requestKey={randomUUID()}/>
      </section>
      <aside className="platform-card h-fit p-6"><div className="platform-stat-icon mb-4"><ShieldCheck size={19}/></div><h2 className="platform-card-title">Before you continue</h2>
        <p className="platform-card-description mt-3">Workspaces receive their own HR accounts, staff sessions and records. This form does not create employee profiles or process payroll.</p>
        <div className="platform-muted-box mt-5">The initial HR administrator receives a single-use email invitation. Only an authorized recipient can activate it.</div>
      </aside>
    </div>
  </div>;
}
