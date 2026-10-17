// Local audit instrumentation only; logs duration/table names without SQL or parameters.
const client = require('@prisma/client');
const Original = client.PrismaClient;
class AuditPrismaClient extends Original {
  constructor(options = {}) {
    super({ ...options, log: [{ emit: 'event', level: 'query' }, { emit: 'event', level: 'error' }] });
    this.$on('query', event => {
      const tables = [...new Set([...event.query.matchAll(/(?:FROM|JOIN|UPDATE|INTO)\s+(?:"public"\.)?"(\w+)"/gi)].map(match => match[1]))];
      console.info('[Audit query] ' + JSON.stringify({ ms: event.duration, tables }));
    });
    this.$on('error', event => {
      const missing = [...event.message.matchAll(/(?:column|table)\s+[`'"]?([\w.]+)[`'"]?\s+(?:does not exist|in the current database)/gi)].map(match => match[1]);
      const codes = [...new Set(event.message.match(/P\d{4}/g) || [])];
      console.info('[Audit db error] ' + JSON.stringify({ codes, missing }));
    });
  }
}
Object.defineProperty(client, 'PrismaClient', { value: AuditPrismaClient, configurable: true, writable: true });
