const fs = require('node:fs');
const { PrismaClient } = require('@prisma/client');
const helper = require('../../../scripts/batch0-recovery-environment.cjs');
exports.verify = async () => {
  const config = helper.configuration();
  if (config.identity.branchId !== 'br-damp-fog-azmmxhga' || config.identity.endpointId !== 'ep-wild-mud-az8yzifu' || !config.identity.distinctFromProtectedOriginal) throw Error('WRONG_RECOVERY_TARGET');
  const reader = new PrismaClient({ datasources: { db: { url: helper.readOnly(config.direct) } }, log: [] });
  try {
    const [identity] = await reader.$queryRawUnsafe("SELECT current_database() AS database,current_schema() AS schema,current_setting('default_transaction_read_only') AS read_only,current_setting('neon.branch_id',true) AS branch_id,current_setting('neon.endpoint_id',true) AS endpoint_id");
    if (identity.branch_id !== config.identity.branchId || identity.endpoint_id !== config.identity.endpointId || identity.read_only !== 'on' || identity.database !== config.identity.database || identity.schema !== 'public') throw Error('LIVE_RECOVERY_MISMATCH');
    const history = await reader.$queryRawUnsafe('SELECT migration_name,checksum FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name');
    const local = fs.readdirSync('prisma/migrations', { withFileTypes: true }).filter(e => e.isDirectory());
    if (history.length !== local.length) throw Error('HISTORY_COUNT_MISMATCH');
    for (const row of history) {
      const text = fs.readFileSync(`prisma/migrations/${row.migration_name}/migration.sql`, 'utf8');
      if (![text, text.replace(/\r\n/g, '\n'), text.replace(/\r?\n/g, '\r\n')].some(s => helper.digest(s) === row.checksum)) throw Error('HISTORY_CHECKSUM_MISMATCH');
    }
    return { identity, migrationsVerified: history.length, migrationsExecuted: 0, providerProject: 'late-block-61364102', providerBranch: 'workpulse-ess-design', primary: false, default: false };
  } finally { await reader.$disconnect(); }
};
