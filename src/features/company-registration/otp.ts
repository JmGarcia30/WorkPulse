import 'server-only';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

// A keyed verifier is essential: a database-only attacker can enumerate all
// six-digit values against an unkeyed hash. Domain separation avoids key reuse.
export function otpVerifier(email: string, nonce: string, code: string) {
  const key = process.env.COMPANY_REGISTRATION_OTP_SECRET || process.env.SESSION_SECRET;
  if (!key || key.length < 32) throw Error('Company registration requires a stable secret of at least 32 characters.');
  return createHmac('sha256', key).update(JSON.stringify(['workpulse-company-otp-v1', email, nonce, code])).digest('hex');
}

export function issueRegistrationOtp(email: string) {
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const nonce = randomBytes(32).toString('base64url');
  return { code, nonce, hash: otpVerifier(email, nonce, code), expiresAt: new Date(Date.now() + 10 * 60_000) };
}

export function matchesRegistrationOtp(email: string, nonce: string, code: string, expected: string) {
  const actual = Buffer.from(otpVerifier(email, nonce, code), 'hex');
  const stored = Buffer.from(expected, 'hex');
  return actual.length === stored.length && timingSafeEqual(actual, stored);
}
