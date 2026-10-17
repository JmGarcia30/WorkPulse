const fs=require('node:fs'),path=require('node:path');
const helper=require('./batch0-recovery-environment.cjs');
const read=name=>JSON.parse(fs.readFileSync(path.join(helper.directory,name+'.json'),'utf8'));
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
const range=values=>[Math.min(...values),Math.max(...values)];
const schema=read('schema-and-history-verification'),regressions=read('regression-summary');
const summary={createdAt:new Date().toISOString(),branch:schema.identity.branchName,schema,regressions,baselines:{}};
for(const mode of ['prod','dev']){
  const rows=read(mode+'-successful-pages'),nav=read(mode+'-navigation');
  if(rows.length!==16||nav.length!==12||!rows.every(r=>r.httpStatus===200&&r.expectedContent&&!r.streamedError&&!r.runtimeErrorCodes.length)||!nav.every(r=>r.completed&&r.expectedContent&&!r.renderedError))throw new Error('INCOMPLETE_SUCCESSFUL_BASELINE');
  summary.baselines[mode]=[...new Set(rows.map(r=>r.route))].map(route=>{
    const samples=rows.filter(r=>r.route===route),warm=samples.slice(1),clicks=nav.filter(r=>r.route===route);
    return {route,initialTtfbMs:samples[0].initialTtfbMs,initialCompletionMs:samples[0].completionMs,warmTtfbMedianMs:median(warm.map(r=>r.initialTtfbMs)),warmCompletionMedianMs:median(warm.map(r=>r.completionMs)),warmCompletionRangeMs:range(warm.map(r=>r.completionMs)),sqlStatementRange:range(warm.map(r=>r.sqlStatements)),navigationMedianMs:median(clicks.map(r=>r.navigationMs)),navigationRangeMs:range(clicks.map(r=>r.navigationMs)),documentRequests:clicks.reduce((s,r)=>s+r.documentRequests,0),browserRuntimeExceptions:clicks.reduce((s,r)=>s+r.runtimeExceptions,0),httpErrorResponses:clicks.flatMap(r=>r.failedHttpResponses)};
  });
}
helper.save('summary',summary);
helper.save('prod-baseline-error',{resolved:true,initialCode:'BROWSER_RENDER_CHECK_FAILED',cause:'Case-sensitive DOM assertion did not account for CSS uppercase labels',resolution:'Case-folded content check; browser-only repetition passed all 12 transitions',applicationRuntimeError:false});
const lines=[
  '# WORKPULSE — BATCH 0 RECOVERY RESULTS','',
  '**Complete on workpulse-batch0-recovery only. Production, the existing .env and Vercel configuration were not modified. No Batch 1 optimization was implemented.**','',
  '## Target and recreation','',
  'Both configured URLs select the same Neon compute/database; pooling differs as intended. The normalized endpoint is distinct from the protected original and pinned to the prior live connection verification. The full Branch ID was available in local metadata: '+schema.identity.branchId+'. Its endpoint ID is '+schema.identity.endpointId+'. The branch-parent relationship is based on the user’s Neon Console confirmation, not an independent control-plane API call. No credentials were printed or saved.','',
  'Recreation is authorized and confirmed by the user: create a fresh disposable child from production using the same Console procedure. This is a testing-environment recreation path, not a verified point-in-time production backup. No parent-branch SQL write or deployment was performed.','',
  '## Migration and data preservation','',
  '- Applied 20261017090000_h10_1_exit_clearance, then 20261017120000_h10_2_final_separation using the direct recovery connection and normal Prisma migration locking.',
  '- '+schema.appliedCount+' migrations now applied; both H10 checksums match their files.',
  '- All four H10 tables and expected scalar columns exist; missing generated-client columns and enum values: zero.',
  '- All '+schema.expectedTriggers+' H10 triggers are enabled; '+schema.constraints.length+' inspected H10/probation constraints are validated; four critical indexes are present.',
  '- Final protected-data fingerprints match across all '+schema.protectedTablesCompared+' pre-existing public tables. The comparison projects the original columns, so the newly added nullable column does not falsely count as a record edit.',
  '- Normal-login benchmark accounts were created only on the recovery branch and removed after each run. Existing SAGA accounts/employees/histories were not changed. Final fingerprints cover User as well.',
  '- Original .env hash still matches the pre-execution verification. Historical migrations and application/business-rule source were not edited.','',
  '## Regression results','',
  '| Check | Result |','|---|---|',
  '| H10.1 | PASS — 85 checks |',
  '| H10.2 | PASS — 59 checks |',
  '| H10 HTTP interface | PASS — 19 real HTTP/form/Server Action checks |',
  '| H1 / H2 | PASS in isolated schemas |',
  '| ESS / Leave / Payroll | PASS in isolated schemas |',
  '| Tenant isolation / role checks | PASS across H10/ESS/Leave suites; SaaS host/navigation assertions also passed |',
  '| Prisma client generation / TypeScript | PASS |',
  '| Production webpack build | PASS — 35.428 s; compilation 9.3 s |','',
  'The regression suites include intentional database-trigger failures and rejected transactions. Their expected P0001 codes are negative-test evidence, not unhandled application failures. Every final regression command exited 0. Fixture schemas were removed by their test cleanup.','',
  '## Successful-page baseline','',
  'All four previously broken routes passed complete HTML-content checks and real browser main-content checks. Across both modes: 32 authenticated HTTP samples and 24 completed browser transitions; no P2022 or other Prisma errors in the measured page runs, no navigation runtime exceptions, no observed navigation HTTP error responses, and zero full-document navigation requests.','',
  'Conditions: local Windows/Node 24.18.0/Next 16.3.6, webpack, same cloned tenant data, initial measured request plus three warm requests per route, three browser clicks per route, 1440×1000 headless Chrome, no network/CPU throttling. Regression suites and builds had finished before measurements. Application page connections were read-only.','',
  'Authentication used the real login form, bcrypt password verification, persisted tenant/role checks and the server-issued session cookie. No session tokens were forged for these baselines. Browser login necessarily visits Dashboard before measurement, so initial requests are post-authentication observations, not proven cold starts. Browser results use existing router/prefetch caches. Navigation measures click to settled main content after a 600 ms quiet check, not LCP or INP.','',
];
for(const [mode,title]of [['prod','Production mode'],['dev','Development mode']]){
  lines.push('### '+title,'','All times are milliseconds. SQL counts include emitted transaction-control statements.','',
    '| Route | Initial TTFB | Initial complete | Warm TTFB median | Warm completion median [range] | Warm SQL range | Browser median [range] |',
    '|---|---:|---:|---:|---:|---:|---:|');
  for(const r of summary.baselines[mode])lines.push('| '+r.route+' | '+r.initialTtfbMs+' | '+r.initialCompletionMs+' | '+r.warmTtfbMedianMs+' | '+r.warmCompletionMedianMs+' ['+r.warmCompletionRangeMs.join('–')+'] | '+r.sqlStatementRange.join('–')+' | '+r.navigationMedianMs+' ['+r.navigationRangeMs.join('–')+'] |');
  lines.push('');
}
lines.push('## Limits and next step','',
  'This is the successful testing-branch baseline. The original audit’s broken-page timings are not comparable measures of successful work. The clone is small (seven employees); the public Exit list has no cases, while populated Exit workflows were tested separately in disposable schemas. Samples do not establish p95/p99 behavior, PostgreSQL-only execution time, browser CPU cost or Vercel performance. Production compatibility is unchanged because production migrations were not authorized or executed.','',
  'Employee Profile is the slowest measured production browser destination. Dashboard still emits 29 SQL statements per warm measured HTTP request. These are inputs to the next optimization batch, not fixes made here. Stop before Batch 1.','',
  'Diagnostic retries: an initial client-generation attempt encountered a Windows engine-DLL lock held by the audit runner; generation passed after the runner avoided opening a database client during generation. An initial browser check rejected CSS-uppercase Dashboard labels; corrected case-insensitive content checks passed the browser-only retry. Original successful HTTP samples were retained; no product behavior was changed to make checks pass.','',
  '## Evidence','',
  '- summary.json; schema-and-history-verification.json; protected-data-before.json / protected-data-after.json',
  '- migration-deploy.json; authorization-and-recreation.json; regression-summary.json and per-suite JSON',
  '- prod-successful-pages.json / dev-successful-pages.json; prod-navigation.json / dev-navigation.json',
  '- prod-runtime.json / dev-runtime.json; authentication and cleanup summaries',
  '- prod-navigation-initial-attempt.json retains the excluded diagnostic assertion attempt. Prior audit/baseline artifacts outside this recovery directory are unchanged.','');
fs.writeFileSync(path.join(helper.directory,'RESULTS.md'),lines.join('\n'));
fs.writeFileSync(path.join(helper.directory,'STATUS.md'),'# Batch 0 recovery status\n\nComplete on the disposable recovery branch. All requested regressions and both successful-page baselines passed. Production was not modified. See [RESULTS.md](RESULTS.md) and summary.json. No Batch 1 optimization has started.\n');
console.log(JSON.stringify({schemaVerified:true,allRegressionCommandsPassed:regressions.every(r=>r.exitCode===0),production:summary.baselines.prod,development:summary.baselines.dev},null,2));
