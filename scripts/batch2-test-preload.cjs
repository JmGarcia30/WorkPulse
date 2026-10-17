/* eslint-disable @typescript-eslint/no-require-imports -- Node-only isolated test harness. */
// Allow importing server-only read models with injected fixture DB/branding.
// This is never used by Next servers or browser benchmarks and changes no auth.
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'server-only') return {};
  return originalLoad.call(this, request, parent, isMain);
};
require('./performance-audit-preload.cjs');
