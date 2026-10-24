/* eslint-disable @typescript-eslint/no-require-imports -- Read-only local configuration readiness, never prints credentials or connects to production. */
const fs = require('node:fs'), { parseEnv } = require('node:util');
const local = parseEnv(fs.readFileSync('.env', 'utf8'));
const root = local.PLATFORM_ROOT_DOMAIN?.toLowerCase() || '';
const configurationKind = !root ? 'MISSING_ROOT' : root.startsWith('localhost') || root.startsWith('127.0.0.1') ? 'LOCAL_ONLY' : root.endsWith('.vercel.app') ? 'SAGA_ONLY_DEPLOYMENT_HOST' : 'CUSTOM_ROOT_UNVERIFIED';
let originMatchesRoot = false, httpsPublicOrigin = false;
try { const origin = new URL(local.PLATFORM_PUBLIC_ORIGIN); originMatchesRoot = origin.host === root; httpsPublicOrigin = origin.protocol === 'https:'; } catch {}
const result = {
  configurationKind, rootDomainPresent: !!root, publicOriginPresent: !!local.PLATFORM_PUBLIC_ORIGIN, originMatchesRoot, httpsPublicOrigin,
  sessionSecretConfigured: (local.SESSION_SECRET?.length || 0) >= 32,
  smtpCredentialInputsPresent: !!((local.GMAIL_USER || local.SMTP_USER) && (local.GMAIL_APP_PASSWORD || local.SMTP_PASSWORD)),
  vercelProjectFilePresent: fs.existsSync('.vercel/project.json'),
  domainOwnershipVerified: false, productionDNSVerified: false, productionHTTPSVerified: false, vercelDomainBindingsVerified: false, realSMTPDeliverabilityVerified: false,
  productionOnboardingReady: false,
  note: 'Local configuration presence is not evidence of domain ownership, DNS, HTTPS, Vercel bindings or mail delivery. No production endpoint or provider was contacted.',
};
fs.mkdirSync('docs/platform-phase-3', { recursive: true });
fs.writeFileSync('docs/platform-phase-3/local-domain-readiness.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
