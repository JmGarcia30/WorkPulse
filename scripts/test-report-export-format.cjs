/* Focused, read-only export format tests. Run: node -r tsx/cjs scripts/test-report-export-format.cjs */
const assert = require('node:assert/strict');
const { PDFDocument } = require('pdf-lib');
const { csvCell, csvDocument, fileResponse, pdfDocument } = require('../src/features/reports/export-utils.ts');

async function run() {
  assert.equal(csvCell('Normal, "quoted"'), '"Normal, ""quoted"""');
  for (const formula of ['=1+1', '+SUM(A1)', '-4+5', '@COMMAND', '  =HYPERLINK("x")']) {
    assert.equal(csvCell(formula).startsWith('"'+ "'"), true, 'CSV formula must be neutralized');
  }
  const csv = csvDocument(['Name', 'Note'], [['Test', 'line\nbreak'], ['Danger', '=1+1']]);
  assert(csv.startsWith('\uFEFF'));
  assert(csv.includes('"line break"'));
  assert(csv.includes('"\'=1+1"'));
  const csvResponse = fileResponse(csv, 'test.csv', 'csv');
  assert.equal(csvResponse.status, 200);
  assert.match(csvResponse.headers.get('cache-control'), /no-store/);
  assert.match(csvResponse.headers.get('content-disposition'), /attachment/);
  assert.equal(await csvResponse.text(), csv);

  const pdf = await pdfDocument({
    title: 'WorkPulse Attendance',
    organization: 'Test School',
    period: '2026-10',
    sections: [
      { heading: 'Summary', lines: ['Present: 2', 'Absent: 0'] },
      { heading: 'Long list', lines: Array.from({ length: 175 }, (_, index) => 'Employee ' + index + ' | late 0 min') },
      { heading: 'Unsupported glyphs', lines: ['Check unicode: \u2605, \u1e40'] },
    ],
  });
  assert(Buffer.from(pdf).subarray(0, 5).toString() === '%PDF-');
  const document = await PDFDocument.load(pdf);
  assert(document.getPageCount() >= 2, 'Large PDF should paginate');
  const pdfResponse = fileResponse(pdf, 'test.pdf', 'pdf');
  assert.equal(pdfResponse.status, 200);
  assert.equal(pdfResponse.headers.get('content-type'), 'application/pdf');
  assert.match(pdfResponse.headers.get('cache-control'), /no-store/);
  console.log('PASS: CSV escaping, formula protection, private downloads, PDF output and pagination');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
