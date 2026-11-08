import assert from 'node:assert/strict';
import { isCurrentEntitlement, subscriptionTerm, subscriptionMonths, hasFeature, effectiveSubscriptionStatus } from '../src/features/subscriptions/domain';

const now = new Date('2026-11-08T10:00:00Z');
const active = (startsAt: Date | null, endsAt: Date | null, status = 'ACTIVE') =>
  isCurrentEntitlement({ status, startsAt, endsAt }, now);

assert.equal(active(null, null), true, 'legacy active subscriptions have no expiry');
assert.equal(active(new Date('2026-11-07T00:00:00Z'), new Date('2026-11-09T00:00:00Z')), true);
assert.equal(active(new Date('2026-11-09T00:00:00Z'), null), false);
assert.equal(active(null, now), false, 'entitlement expires at exact timestamp');
assert.equal(active(null, null, 'PENDING'), false);
assert.equal(active(null, null, 'PAST_DUE'), false);
assert.equal(active(null, null, 'CANCELLED'), false);
assert.equal(active(null, null, 'EXPIRED'), false);
assert.equal(isCurrentEntitlement(null, now), false);

assert.equal(subscriptionTerm(new Date('2027-01-31T12:00:00Z'), 'MONTHLY').toISOString(), '2027-02-28T12:00:00.000Z');
assert.equal(subscriptionTerm(new Date('2028-01-31T12:00:00Z'), 'MONTHLY').toISOString(), '2028-02-29T12:00:00.000Z');
assert.equal(subscriptionTerm(new Date('2028-02-29T12:00:00Z'), 'YEARLY').toISOString(), '2029-02-28T12:00:00.000Z');
assert.equal(subscriptionTerm(new Date('2026-11-08T10:00:00Z'), 'YEARLY').toISOString(), '2027-11-08T10:00:00.000Z');

console.log('Subscription domain tests passed: expiry, statuses, legacy and calendar rollovers.');

assert.equal(subscriptionMonths(new Date('2028-02-29T12:00:00Z'), 24).toISOString(), '2030-02-28T12:00:00.000Z');
for (const invalid of [0, -1, 1.5, NaN, Infinity, 121]) assert.throws(() => subscriptionMonths(now, invalid));
const plan = { aiResumeParsing: true, advancedAnalytics: false, gmailIntegration: false, customBranding: false };
const record = { status: 'ACTIVE', startsAt: null, endsAt: now, legacyAccess: false, plan };
assert.equal(hasFeature(record,'aiResumeParsing',now),false);
assert.equal(hasFeature({ ...record, legacyAccess:true },'gmailIntegration',now),true);
assert.equal(hasFeature({ ...record, endsAt:null },'aiResumeParsing',now),true);
assert.equal(hasFeature({ ...record, endsAt:null },'advancedAnalytics',now),false);
assert.equal(effectiveSubscriptionStatus(record,now),'EXPIRED');
assert.equal(effectiveSubscriptionStatus(null,now),'UNASSIGNED');
console.log('Manual subscription tests passed: explicit duration validation, two-year leap rollover, optional flags and preserved legacy access.');
