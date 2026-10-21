import { notFound } from 'next/navigation';
import { RecruitmentDocumentType } from '@prisma/client';
import { getDocumentStaffContext } from '@/features/hiring/document-access';
import { prisma } from '@/lib/db/prisma';
import { resolveHiringDocumentPolicy } from '@/features/hiring/document-policy';
import { saveHiringDocumentPolicy } from '@/features/hiring/document-policy-actions';

export default async function HiringSettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const actor = await getDocumentStaffContext();
  if (!actor || !['ORGANIZATION_ADMIN', 'HR_ADMIN'].includes(actor.role)) notFound();
  const organization = await prisma.organization.findUniqueOrThrow({ where: { id: actor.organizationId }, select: { id: true, slug: true, name: true, hiringDocumentRequirements: true } });
  const query = await searchParams;
  return <div className="min-w-0 space-y-6">
    <header><h1 className="text-2xl font-bold">Hiring document requirements</h1><p className="mt-2 text-sm text-[var(--wp-text-muted)]">Configure recruitment uploads for {organization.name}. Job structured requirements remain qualification criteria.</p></header>
    {query.saved && <p role="status">Requirements saved for this organization.</p>}
    {query.error && <p role="alert">Check titles and submission targets. A document can be mandatory or conditional, not both.</p>}
    <p className="text-sm">Changes apply to current and future checklists when opened or initialized. Existing files and document IDs are retained; removed requirements stop blocking hiring. Disabling every document intentionally creates an empty checklist.</p>
    <form action={saveHiringDocumentPolicy} className="space-y-6">
      {(['TEACHING','NON_TEACHING'] as const).map(category => {
        const policy = resolveHiringDocumentPolicy(organization, category);
        return <fieldset key={category} className="min-w-0 space-y-4"><legend className="mb-3 font-semibold">{category === 'TEACHING' ? 'Teaching positions' : 'Non-teaching positions'}</legend>
          {Object.values(RecruitmentDocumentType).map(type => {
            const current = policy.requirements.find(d => d.type === type), prefix = `${category}.${type}.`;
            return <details key={type} className="rounded-lg border border-[var(--wp-border)] bg-[var(--wp-surface)] p-4" open={!!current}>
              <summary className="cursor-pointer break-words text-sm font-semibold">{current?.title || type.replaceAll('_',' ')}</summary>
              <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
                <label className="text-sm"><input name={prefix+'enabled'} type="checkbox" defaultChecked={!!current} /> Request this document</label>
                <div className="flex flex-wrap gap-4 text-sm"><label><input name={prefix+'required'} type="checkbox" defaultChecked={current?.isRequired} /> Mandatory</label><label><input name={prefix+'conditional'} type="checkbox" defaultChecked={current?.isConditional} /> Conditional</label></div>
                <label className="wp-label">Title<input className="wp-input mt-1" name={prefix+'title'} defaultValue={current?.title || type.replaceAll('_',' ')} maxLength={160} /></label>
                <label className="wp-label">Submit to<input className="wp-input mt-1" name={prefix+'target'} defaultValue={current?.submissionTarget || 'Hiring team'} maxLength={160} /></label>
                <label className="wp-label">Description<textarea className="wp-input mt-1" name={prefix+'description'} defaultValue={current?.description || ''} maxLength={1000} /></label>
                <label className="wp-label">Conditional note<textarea className="wp-input mt-1" name={prefix+'note'} defaultValue={current?.conditionalNote || ''} maxLength={500} /></label>
              </div>
            </details>;
          })}
        </fieldset>;
      })}
      <button className="wp-button-primary" type="submit">Save document requirements</button>
    </form>
  </div>;
}
