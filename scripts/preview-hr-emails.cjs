/* eslint-disable @typescript-eslint/no-require-imports -- Safe mock previews; no database or email delivery. */
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
function writePreviews() {
  require('tsx/cjs');
  const original = Module._load;
  try {
    Module._load = function(name, parent, main) { if (name === 'server-only') return {}; if (name.startsWith('@/')) return original.call(this, path.resolve('src', name.slice(2)), parent, main); return original.call(this, name, parent, main); };
    const { renderHrEmail, HR_EMAIL_TYPES, HR_EMAIL_LABELS, mockHrEmailDetails } = require('../src/features/email-integration/hr-templates.ts');
    const directory = 'docs/hr-email-templates/previews';
    const brands = {
      saga: { name: 'St. Aloysius Gonzaga Academy', slug: 'st-aloysius', inlineLogo: { content: fs.readFileSync('public/branding/saga-logo.jpg'), contentType: 'image/jpeg', cid: 'preview-logo' } },
      company: { name: 'Northstar Services', slug: 'northstar-services', inlineLogo: { content: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><rect width="72" height="72" rx="10" fill="#17324d"/><text x="36" y="46" text-anchor="middle" font-family="Arial" font-size="28" fill="white">NS</text></svg>'), contentType: 'image/svg+xml', cid: 'preview-logo' } },
      'no-logo': { name: 'Example Company', slug: 'example-company' },
    };
    for (const [key, brand] of Object.entries(brands)) {
      fs.mkdirSync(`${directory}/${key}`, { recursive: true });
      for (const type of HR_EMAIL_TYPES) {
        const message = renderHrEmail(brand, type, mockHrEmailDetails());
        const html = message.inlineLogo ? message.html.replace('cid:' + message.inlineLogo.cid, `data:${message.inlineLogo.contentType};base64,${message.inlineLogo.content.toString('base64')}`) : message.html;
        fs.writeFileSync(`${directory}/${key}/${type}.html`, html.replace('<html>', '<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>'));
        fs.writeFileSync(`${directory}/${key}/${type}.txt`, message.text);
      }
    }
    fs.writeFileSync(`${directory}/index.html`, `<!doctype html><html><head><meta charset="utf-8"><title>WorkPulse HR email previews</title></head><body style="font-family:Arial,sans-serif;max-width:1000px;margin:40px auto;padding:0 20px;color:#243244"><h1>HR email template previews</h1><p>Fictional names and details only. No emails are sent by these previews.</p><table cellpadding="12" style="border-collapse:collapse;width:100%"><thead><tr><th>Template</th><th>SAGA</th><th>Northstar Services</th><th>Without a logo</th></tr></thead><tbody>${HR_EMAIL_TYPES.map(type => `<tr style="border-top:1px solid #e2e8f0"><th style="text-align:left">${HR_EMAIL_LABELS[type]}</th>${Object.keys(brands).map(key => `<td><a href="${key}/${type}.html">HTML</a> · <a href="${key}/${type}.txt">Text</a></td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`);
    console.log('Generated 15 HTML previews and 15 plain-text alternatives using mock data; no database access or sends.');
  } finally { Module._load = original; }
}
module.exports = writePreviews;
if (require.main === module) writePreviews();
