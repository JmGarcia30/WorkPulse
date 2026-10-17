/* eslint-disable @typescript-eslint/no-require-imports -- Offline benchmark summarizer. */
const fs = require('node:fs');
const directory = 'docs/performance-audit/batch-3';
const samples = JSON.parse(fs.readFileSync(directory + '/service-samples.json'));
const median = values => { const a = [...values].sort((a, b) => a - b); return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2; };
const rows = [];
for (const [workload, size] of [['payroll-generation', 5], ['payroll-generation', 50], ['payroll-generation', 100], ['attendance-period', 3]]) {
  const row = { workload, employees: size };
  for (const mode of ['before', 'after']) {
    const values = samples.filter(r => r.workload === workload && (r.size || r.employees) === size && r.mode === mode && r.iteration > 0);
    if (values.length !== 3) throw Error('INCOMPLETE_WARM_SAMPLES');
    row[mode] = { samples: values.length, medianMs: median(values.map(r => r.ms)), medianSql: median(values.map(r => r.sql)), msRange: [Math.min(...values.map(r => r.ms)), Math.max(...values.map(r => r.ms))], sqlRange: [Math.min(...values.map(r => r.sql)), Math.max(...values.map(r => r.sql))] };
  }
  row.timeReductionPercent = (1 - row.after.medianMs / row.before.medianMs) * 100;
  row.sqlReductionPercent = (1 - row.after.medianSql / row.before.medianSql) * 100;
  rows.push(row);
}
const result = { conditions: {
  environment: 'Local Node/tsx service benchmarks against disposable schemas on workpulse-batch0-recovery; direct Neon connections',
  samples: 'Four alternating before/after pairs per workload; first pair excluded, median of three warm samples',
  oracle: 'Frozen pre-Batch-3 service implementations; only import paths adjusted',
  sql: 'Prisma query events including emitted controls and pool probes; instrumentation adds no SQL',
  comparisons: 'Every benchmark pair compares complete result and persisted values/snapshots; only generated payroll-entry IDs and volatile timestamps excluded',
  load: 'Focused H3/H6/H8 fixture suites overlapped part of the run. No other benchmark/build/UI workload ran during the later 100-employee and Attendance samples. External database load not controlled.',
  notMeasured: ['Vercel', 'browser navigation', 'HTTP response/TTFB', 'production data workloads', 'cold starts'],
}, rows };
fs.writeFileSync(directory + '/summary.json', JSON.stringify(result, null, 2));
for (const row of rows) console.log(JSON.stringify(row));
