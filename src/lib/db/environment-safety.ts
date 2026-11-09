type Environment = Record<string, string | undefined>;
export type DatabaseIdentity = { project: string; branch: string; endpoint: string; database: string };
export type RuntimeIdentity = { database: string; branch_id: string | null; endpoint_id: string | null };

// Provider-confirmed production target. Preview must never use this branch/compute.
export const productionDatabase: DatabaseIdentity = {
  project: 'late-block-61364102', branch: 'br-hidden-violet-azjl3vam',
  endpoint: 'ep-weathered-mouse-azpx765h', database: 'neondb',
};

// Dedicated synthetic-data Preview target for the payroll quick-flow review.
// No Production environment can select this target.
export const payrollQuickflowPreviewDatabase: DatabaseIdentity = {
  project: 'purple-tree-62095489', branch: 'br-broad-recipe-az027wby',
  endpoint: 'ep-shiny-boat-azdvf3sd', database: 'workpulse_preview',
};

function reject(): never { throw new Error('WORKPULSE_DATABASE_IDENTITY_REJECTED'); }

export function assertHostedSessionSecret(env: Environment = process.env) {
  if (!['production', 'preview'].includes(env.VERCEL_ENV || '')) return;
  const secret = env.SESSION_SECRET;
  // This value has always been public in the tracked example; it is not a credential.
  const publicTemplate = 'workpulse_secret_key_change_in_production_32chars!';
  if (!secret || secret.length < 32 || secret === publicTemplate ||
      secret.startsWith('workpulse_development_only_')) throw new Error('WORKPULSE_SESSION_SECRET_REJECTED');
}

/** Server-only configuration. Never include a URL or provider error in diagnostics. */
export function databaseTarget(env: Environment = process.env): DatabaseIdentity | null {
  if (!env.VERCEL_ENV) {
    if (env.VERCEL === '1') reject();
    return null; // Existing local test profiles remain local.
  }
  if (env.VERCEL_ENV === 'development') return null;
  if (!['production', 'preview'].includes(env.VERCEL_ENV)) reject();
  const target = {
    project: env.WORKPULSE_DB_PROJECT_ID || '', branch: env.WORKPULSE_DB_BRANCH_ID || '',
    endpoint: env.WORKPULSE_DB_ENDPOINT_ID || '', database: env.WORKPULSE_DB_DATABASE || '',
  };
  const approvedSyntheticPreview = env.VERCEL_ENV === 'preview' &&
    Object.keys(payrollQuickflowPreviewDatabase).every(key =>
      target[key as keyof DatabaseIdentity] === payrollQuickflowPreviewDatabase[key as keyof DatabaseIdentity]);
  if ((target.project !== productionDatabase.project && !approvedSyntheticPreview) ||
      !/^br-[a-z0-9-]+$/.test(target.branch) ||
      !/^ep-[a-z0-9-]+$/.test(target.endpoint) || !/^[a-zA-Z0-9_]+$/.test(target.database)) reject();
  if (env.VERCEL_ENV === 'production' && Object.keys(target).some(key =>
    target[key as keyof DatabaseIdentity] !== productionDatabase[key as keyof DatabaseIdentity])) reject();
  if (env.VERCEL_ENV === 'preview' &&
      (target.branch === productionDatabase.branch || target.endpoint === productionDatabase.endpoint)) reject();
  try {
    const url = new URL(env.DATABASE_URL || '');
    // Exact hostname check also rejects alternate hosts and URL routing overrides.
    const directHost = `${target.endpoint}.c-3.ap-southeast-1.aws.neon.tech`;
    const poolHost = `${target.endpoint}-pooler.c-3.ap-southeast-1.aws.neon.tech`;
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || ![directHost, poolHost].includes(url.hostname) ||
        decodeURIComponent(url.pathname.slice(1)) !== target.database || url.hash ||
        (url.port && url.port !== '5432') || !url.username || !url.password ||
        !['require', 'verify-full'].includes(url.searchParams.get('sslmode') || '')) reject();
    const allowed = new Set(['sslmode', 'channel_binding', 'pgbouncer', 'connection_limit', 'pool_timeout', 'connect_timeout', 'schema']);
    for (const key of url.searchParams.keys()) {
      if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1) reject();
    }
    if (url.searchParams.has('schema') && url.searchParams.get('schema') !== 'public') reject();
  } catch { reject(); }
  return target;
}

export async function verifyDatabaseIdentity(target: DatabaseIdentity, query: () => Promise<RuntimeIdentity[]>) {
  let rows: RuntimeIdentity[];
  try { rows = await query(); } catch { reject(); }
  if (rows.length !== 1 || rows[0].database !== target.database ||
      rows[0].branch_id !== target.branch || rows[0].endpoint_id !== target.endpoint) reject();
  // Project membership is verified separately against Neon metadata, never inferred from SQL/database name.
  return { ...target, projectVerification: 'requires-provider-mapping' as const };
}
