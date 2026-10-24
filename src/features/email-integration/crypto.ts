import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function encryptionKey() {
  const raw = process.env.EMAIL_OAUTH_ENCRYPTION_KEY || '';
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32 || key.toString('base64') !== raw) throw Error('EMAIL_ENCRYPTION_NOT_CONFIGURED');
  return key;
}
export function encryptionConfigured() { try { encryptionKey(); return true; } catch { return false; } }
export function encryptSecret(value: unknown, context: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from('workpulse-email-v1:' + context));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}
export function decryptSecret<T>(value: string, context: string): T {
  try {
    const [version, nonce, tag, encrypted, extra] = value.split('.');
    if (version !== 'v1' || extra || !nonce || !tag || !encrypted) throw Error();
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(nonce, 'base64url'));
    decipher.setAAD(Buffer.from('workpulse-email-v1:' + context));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8')) as T;
  } catch { throw Error('EMAIL_CREDENTIALS_UNAVAILABLE'); }
}
