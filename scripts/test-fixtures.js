const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse/lib/pdf-parse.js');

const files = [
  'sample-resumes/Alex_Rivera_Senior_FullStack_Engineer.pdf',
  'sample-resumes/Elena_Santos_Senior_STEM_Educator.pdf',
  'sample-resumes/Marcus_Vance_IT_Operations_Lead.pdf',
  'sample-resumes/Sarah_Jenkins_Guidance_Counselor.pdf',
  'storage/resumes/seed-ana-reyes-resume.pdf',
  'storage/resumes/seed-carlos-mendoza-cv.pdf',
  'storage/resumes/1786387240215-41f844f63c8fcd75f8764c3ffb5d0e84.pdf',
  'storage/resumes/1786386150061-4ea5e430557a9d0ea795942437078eea.pdf'
];

async function main() {
  console.log('Testing PDF extraction on all fixtures:');
  for (const f of files) {
    const fullPath = path.resolve(f);
    if (!fs.existsSync(fullPath)) {
      console.log(`File not found: ${f}`);
      continue;
    }
    const buf = fs.readFileSync(fullPath);
    console.log(`\n--- Fixture: ${f} (${buf.length} bytes) ---`);
    
    // Test direct buffer
    try {
      // isolated copy
      const copy = new Uint8Array(buf.byteLength);
      copy.set(buf);
      const res = await pdfParse(copy);
      console.log(`SUCCESS: chars=${res.text.trim().length}, words=${res.text.trim().split(/\s+/).filter(Boolean).length}`);
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      if (err.name) console.log(`  Error name: ${err.name}`);
      if (err.stack) console.log(`  Error stack:\n${err.stack.split('\n').slice(0, 5).join('\n')}`);
    }
  }
}

main();
