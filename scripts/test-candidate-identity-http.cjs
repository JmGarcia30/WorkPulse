/* eslint-disable @typescript-eslint/no-require-imports -- Reuse the original HTTP probes as strict denial tests. */
module.exports = args => require('./test-candidate-document-http.cjs')({ ...args, identityReview: true });
