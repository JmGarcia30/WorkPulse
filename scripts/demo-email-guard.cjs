// Local process guard only; never reports an external delivery as successful.
// A private local test outbox accepts synthetic recipients only. This permits
// normal single-use activation without external delivery or forged credentials.
process.env.GMAIL_USER = 'local-demo@fixture.invalid';
process.env.GMAIL_APP_PASSWORD = 'local-test-outbox-only';
process.env.EMAIL_FROM = 'local-demo@fixture.invalid';
process.env.SMTP_HOST = '127.0.0.1';
process.env.SMTP_PORT = '1026';
process.env.SMTP_SECURE = 'false';
const originalFetch = globalThis.fetch;
globalThis.fetch = function(input, init) {
  const url = String(input?.url || input);
  if (/https?:\/\/[^/]*(?:googleapis\.com|accounts\.google\.com|sendgrid|resend\.com|mailgun)/i.test(url)) return Promise.reject(Error('DEMO_EXTERNAL_EMAIL_BLOCKED'));
  return originalFetch(input, init);
};
