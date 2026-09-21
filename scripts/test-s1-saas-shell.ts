import assert from 'node:assert/strict';
import { parsePlatformHost } from '../src/lib/tenant/host';
import { brandColorSchema, organizationBrandingSchema, readableForeground } from '../src/features/organization-branding/schema';

assert.equal(parsePlatformHost('localhost:3000', 'localhost:3000').kind, 'public');
assert.equal(parsePlatformHost('app.localhost:3000', 'localhost:3000').kind, 'discovery');
const tenant = parsePlatformHost('SAGA.localhost:3000', 'localhost:3000');
assert.equal(tenant.kind, 'tenant'); if (tenant.kind === 'tenant') assert.equal(tenant.slug, 'saga');
assert.equal(parsePlatformHost('api.localhost:3000', 'localhost:3000').kind, 'invalid');
assert.equal(parsePlatformHost('saga.evil.test', 'localhost:3000').kind, 'invalid');
assert.equal(brandColorSchema.safeParse('red; background:url(x)').success, false);
assert.equal(brandColorSchema.parse('#17324d'), '#17324D');
assert.equal(organizationBrandingSchema.safeParse({ displayName: 'SAGA', tagline: '', primaryColor: '#742A2A', accentColor: '#B68B2C', address: '', contactEmail: '', contactPhone: '' }).success, true);
assert.equal(readableForeground('#000000'), '#FFFFFF');
console.log('S1 SaaS shell: 10 assertions passed.');
