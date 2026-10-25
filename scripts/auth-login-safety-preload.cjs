/* eslint-disable @typescript-eslint/no-require-imports -- Test-process-only datasource guard; never changes the application's configuration. */
const Module = require('node:module');
const { createHash } = require('node:crypto');
const original = Module._load;
Module._load = function(name, parent, main) {
  const loaded = original.call(this, name, parent, main);
  if (name !== '@prisma/client') return loaded;
  return { ...loaded, PrismaClient: class extends loaded.PrismaClient {
    constructor(options) {
      const value = options?.datasources?.db?.url ?? options?.datasourceUrl ?? process.env.DATABASE_URL;
      const url = new URL(value);
      const safe = url.hostname.replace('-pooler.', '.') === process.env.WORKPULSE_LOGIN_EXPECTED_HOST && url.pathname === '/neondb'
        && createHash('sha256').update(value).digest('hex') === process.env.WORKPULSE_LOGIN_EXPECTED_URL_HASH
        && url.searchParams.get('options')?.includes('default_transaction_read_only=on');
      if (!safe) throw Error('LOGIN_TEST_DATASOURCE_REJECTED_BEFORE_INITIALIZATION');
      console.log('LOGIN_DATASOURCE_GUARD', JSON.stringify({ authorizedDevelopmentOnly: true, readOnly: true, runtimeEnvironment: process.env.NODE_ENV,
        expectedRoutingEnvironment: process.env.PLATFORM_ROOT_DOMAIN === 'workpulse-sprint1-preview.vercel.app' && process.env.PLATFORM_PUBLIC_ORIGIN === 'https://workpulse-sprint1-preview.vercel.app' }));
      super(options);
    }
  } };
};
