/* eslint-disable @typescript-eslint/no-require-imports -- Offline sanitized measurement summary. */
const fs = require('node:fs');
const directory = 'docs/performance-audit/final-ux';
const read = name => JSON.parse(fs.readFileSync(`${directory}/${name}.json`));
function distribution(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return { median: sorted[Math.floor(sorted.length / 2)], min: sorted[0], max: sorted.at(-1), samples: sorted.length };
}
const result = {};
for (const mode of ['production', 'development']) {
  result[mode] = {};
  for (const route of ['Employee Profile', 'Hiring', 'Dashboard', 'Employees']) {
    result[mode][route] = {};
    for (const label of ['before', 'after']) {
      const navigation = read(`${label}-${mode}-navigation`).filter(row => row.cycle > 0 && row.route === route);
      const http = read(`${label}-${mode}-http`).filter(row => row.iteration > 0 && row.route === route);
      result[mode][route][label] = {
        navigationMs: distribution(navigation.map(row => row.navigationMs)),
        completionMs: distribution(http.map(row => row.completionMs)),
        ttfbMs: distribution(http.map(row => row.ttfbMs)),
        sqlStatements: distribution(http.map(row => row.sqlStatements)),
        dataStatements: distribution(http.map(row => row.queries.filter(query => query.tables.length).length)),
        runtimeErrors: navigation.reduce((sum, row) => sum + row.runtimeExceptions + (row.consoleErrors || 0), 0) + http.reduce((sum, row) => sum + row.runtimeCodes.length + Number(row.streamedError), 0),
        documentRequests: navigation.reduce((sum, row) => sum + row.documentRequests, 0),
        afterRendering: label === 'after' ? navigation.map(row => row.rendering) : undefined,
      };
    }
  }
}
fs.writeFileSync(`${directory}/summary.json`, JSON.stringify(result, null, 2));
for (const mode of Object.keys(result)) for (const [route, phases] of Object.entries(result[mode])) {
  const round = value => Math.round(value);
  console.log(JSON.stringify({ mode, route, navigation: [phases.before.navigationMs.median, phases.after.navigationMs.median], server: [round(phases.before.completionMs.median), round(phases.after.completionMs.median)], sql: [phases.before.dataStatements.median, phases.after.dataStatements.median], errors: phases.before.runtimeErrors + phases.after.runtimeErrors }));
}
