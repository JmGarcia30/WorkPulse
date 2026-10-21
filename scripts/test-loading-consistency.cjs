/* eslint-disable @typescript-eslint/no-require-imports -- Render actual server fallbacks and check route inheritance. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { execFileSync } = require('node:child_process');
require('tsx/cjs');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const { PageSkeleton } = require('../src/components/ui/PageSkeleton.tsx');
const kinds = ['dashboard','employees','jobs','attendance','leave','payroll','analytics','profile','pipeline','interviews','hiring','list','records','detail','form','settings','calendar','payslip','self-service','careers','candidate'];
const gallery = kinds.map(kind => {
  const markup = renderToStaticMarkup(React.createElement(PageSkeleton, { kind, label: kind }));
  assert(markup.includes(`data-wp-loading="${kind}"`));
  assert.equal((markup.match(/role="status"/g) || []).length, 1);
  assert(markup.includes('aria-busy="true"') && markup.includes('aria-hidden="true"'));
  assert(!/dark:|slate-900|animate-|<script|<form|<button|<a\s/.test(markup));
  return markup;
});
function walk(folder) { return fs.readdirSync(folder, { withFileTypes:true }).flatMap(entry => entry.isDirectory() ? walk(`${folder}/${entry.name}`) : [`${folder}/${entry.name}`]); }
const files = walk('src/app');
const baseline = new Set(execFileSync('git', ['ls-tree','-r','--name-only','HEAD','--','src/app'], {encoding:'utf8'}).trim().split('\n'));
function nearest(page, exists) {
  let folder = path.posix.dirname(page);
  while (folder.startsWith('src/app')) {
    if (exists(`${folder}/loading.tsx`)) return `${folder}/loading.tsx`;
    folder = path.posix.dirname(folder);
  }
  return null;
}
const coverage = files.filter(f => f.endsWith('/page.tsx') && /\/(?:\(dashboard\)|\(employee\)|careers)\//.test(f)).map(page => ({page, before:nearest(page,f=>baseline.has(f)), after:nearest(page,f=>files.includes(f))}));
assert(coverage.every(row=>row.after), 'Every scoped page must have a relevant inherited boundary');
for (const row of coverage) {
  const source = fs.readFileSync(row.after,'utf8');
  assert(source.includes('PageSkeleton') && !/use client|await |cookies\(|headers\(|catch|setTimeout/.test(source));
}
const expected = {
  'src/app/(dashboard)/dashboard/hiring/offers/page.tsx':'hiring',
  'src/app/(dashboard)/dashboard/hiring/assessments/page.tsx':'hiring',
  'src/app/(dashboard)/dashboard/hiring/onboarding/page.tsx':'hiring',
  'src/app/(dashboard)/dashboard/employees/exit/page.tsx':'list',
  'src/app/(dashboard)/dashboard/hiring/jobs/[jobId]/edit/page.tsx':'form',
  'src/app/(employee)/employee/payroll/[entryId]/page.tsx':'payslip',
  'src/app/careers/[organizationSlug]/portal/[applicationId]/verify/page.tsx':'candidate',
};
for (const [page, kind] of Object.entries(expected)) assert(fs.readFileSync(coverage.find(row=>row.page===page).after,'utf8').includes(`kind="${kind}"`));
fs.mkdirSync('docs/loading-consistency', {recursive:true});
fs.writeFileSync('docs/loading-consistency/coverage.json', JSON.stringify(coverage,null,2));
fs.mkdirSync('storage/loading-consistency', {recursive:true});
fs.writeFileSync('storage/loading-consistency/gallery.json', JSON.stringify(gallery));
console.log(JSON.stringify({staticAccessibleVariants:kinds.length,scopedPages:coverage.length,previouslyUncovered:coverage.filter(r=>!r.before).length,moreSpecificBoundaries:coverage.filter(r=>r.before!==r.after).length}));
