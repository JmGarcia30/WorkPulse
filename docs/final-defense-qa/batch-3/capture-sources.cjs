const fs = require('node:fs'), path = require('node:path'), { createHash } = require('node:crypto');
const out = path.join(__dirname, 'sources'); fs.mkdirSync(out, { recursive: true });
const sources = [
  ['sss-table.jpg', 'https://www.sss.gov.ph/wp-content/uploads/2024/12/Cir-2024-006-Employers-scaled.jpg'],
  ['sss-circular.pdf', 'https://www.sss.gov.ph/wp-content/uploads/2024/12/CI-2024-006-Publication.pdf'],
  ['pagibig-460.pdf', 'https://naro.law.upd.edu.ph/storage/01JQWKTTA92H57M9EWV31W8F1D.pdf'],
  ['bir-annex-e.pdf', 'https://bir-cdn.bir.gov.ph/local/pdf/Annex%20E%20RR%2011-2018.pdf'],
  ['bir-29-2025.pdf', 'https://bir-cdn.bir.gov.ph/BIR/pdf/RR%20No.%2029-2025.pdf'],
  ['philhealth-2026-0042.pdf', 'https://www.philhealth.gov.ph/advisories/2026/PA2026-0042.pdf'],
];
(async () => {
  const results = [];
  for (const [file, url] of sources) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw Error('HTTP_' + response.status);
      const data = Buffer.from(await response.arrayBuffer());
      if (file.endsWith('.pdf') && !data.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw Error('NOT_PDF');
      fs.writeFileSync(path.join(out, file), data);
      let textCharacters;
      if (file.endsWith('.pdf')) {
        try { const pdf = await require('pdf-parse/lib/pdf-parse.js')(data); textCharacters = pdf.text.length; fs.writeFileSync(path.join(out, file + '.txt'), pdf.text); } catch {}
      }
      results.push({ file, url, capturedAt: new Date().toISOString(), status: 'FETCHED', bytes: data.length, sha256: createHash('sha256').update(data).digest('hex'), textCharacters });
    } catch (e) { results.push({ file, url, capturedAt: new Date().toISOString(), status: 'UNAVAILABLE', error: e.message }); }
    console.log(file, results.at(-1).status);
  }
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(results, null, 2));
})();
