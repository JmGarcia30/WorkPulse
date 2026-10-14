import assert from 'node:assert/strict';
import { parsePlatformHost } from '../src/lib/tenant/host';
import { brandColorSchema, organizationBrandingSchema, readableForeground } from '../src/features/organization-branding/schema';

import {
  getTenantPrefix,
  stripTenantPrefix,
  resolveTenantHref,
  isRouteActive,
  isSectionActive,
  isChildRouteActive,
} from '../src/lib/tenant/navigation';

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

// Navigation & route normalization tests
assert.equal(getTenantPrefix('/dashboard/leave'), '');
assert.equal(getTenantPrefix('/saga/dashboard/leave'), '/saga');
assert.equal(getTenantPrefix('/saga/dashboard'), '/saga');
assert.equal(getTenantPrefix('/dashboard'), '');

assert.equal(stripTenantPrefix('/saga/dashboard/leave'), '/dashboard/leave');
assert.equal(stripTenantPrefix('/dashboard/leave'), '/dashboard/leave');
assert.equal(stripTenantPrefix('/saga/dashboard/leave/balances'), '/dashboard/leave/balances');

assert.equal(resolveTenantHref('/dashboard/leave', '/saga/dashboard'), '/saga/dashboard/leave');
assert.equal(resolveTenantHref('/dashboard/leave', '/dashboard'), '/dashboard/leave');
assert.equal(resolveTenantHref('/dashboard/leave/balances', '/saga/dashboard/leave'), '/saga/dashboard/leave/balances');

assert.equal(isRouteActive('/dashboard/leave', '/dashboard/leave'), true);
assert.equal(isRouteActive('/dashboard/leave', '/saga/dashboard/leave'), true);
assert.equal(isRouteActive('/dashboard/leave', '/saga/dashboard/leave/balances'), true);
assert.equal(isRouteActive('/dashboard/leave', '/saga/dashboard/attendance'), false);

assert.equal(isSectionActive('/dashboard/hiring/pipeline', '/saga/dashboard/hiring/jobs', '/dashboard/hiring'), true);
assert.equal(isSectionActive('/dashboard/leave', '/saga/dashboard/leave/balances', '/dashboard/leave'), true);
assert.equal(isSectionActive('/dashboard/attendance', '/saga/dashboard/attendance/schedules', '/dashboard/attendance'), true);
assert.equal(isSectionActive('/dashboard/employees', '/saga/dashboard/employees', '/dashboard/employees'), true);
assert.equal(isSectionActive('/dashboard', '/saga/dashboard'), true);
assert.equal(isSectionActive('/dashboard', '/saga/dashboard/leave'), false);

const leaveChildren = ['/dashboard/leave', '/dashboard/leave/balances', '/dashboard/leave/settings'];
assert.equal(isChildRouteActive('/dashboard/leave', '/saga/dashboard/leave', leaveChildren), true);
assert.equal(isChildRouteActive('/dashboard/leave', '/saga/dashboard/leave/balances', leaveChildren), false);
assert.equal(isChildRouteActive('/dashboard/leave/balances', '/saga/dashboard/leave/balances', leaveChildren), true);
assert.equal(isChildRouteActive('/dashboard/leave/settings', '/saga/dashboard/leave/balances', leaveChildren), false);

console.log('S1 SaaS shell: all assertions passed.');
