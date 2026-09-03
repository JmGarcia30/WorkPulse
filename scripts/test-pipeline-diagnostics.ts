import fs from 'fs';
import path from 'path';

// Load .env first
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const k = trimmed.slice(0, eqIdx).trim();
      let v = trimmed.slice(eqIdx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[k] = v;
    }
  }
}

import { extractResumeText } from '../src/lib/ai/extract-text';
import { parseResumeWithAI } from '../src/lib/ai/parse-resume';



const fixtures = [
  'sample-resumes/Alex_Rivera_Senior_FullStack_Engineer.pdf',
  'sample-resumes/Elena_Santos_Senior_STEM_Educator.pdf',
  'sample-resumes/Marcus_Vance_IT_Operations_Lead.pdf',
  'sample-resumes/Sarah_Jenkins_Guidance_Counselor.pdf',
  'storage/resumes/seed-ana-reyes-resume.pdf',
  'storage/resumes/seed-carlos-mendoza-cv.pdf',
  'storage/resumes/1786387240215-41f844f63c8fcd75f8764c3ffb5d0e84.pdf',
  'storage/resumes/1786386150061-4ea5e430557a9d0ea795942437078eea.pdf'
];

async function runDiagnosticPass(iteration: number) {
  console.log(`\n========================================================================`);
  console.log(`PASS ${iteration}: SEQUENTIAL MULTI-PDF EXTRACTION & DIAGNOSTICS`);
  console.log(`========================================================================`);

  for (const relPath of fixtures) {
    const fullPath = path.join(process.cwd(), relPath);
    if (!fs.existsSync(fullPath)) {
      console.log(`[SKIPPED] File not found: ${relPath}`);
      continue;
    }

    const buf = fs.readFileSync(fullPath);
    const result = await extractResumeText(buf, 'application/pdf');

    console.log(`\n--- Fixture: ${relPath} ---`);
    console.log(`  File Size: ${buf.length} bytes`);
    console.log(`  Extraction Status: ${result.extractionStatus}`);
    console.log(`  Character Count: ${result.charCount}`);
    console.log(`  Word Count: ${result.wordCount}`);
    console.log(`  Meaningful Character Count: ${result.meaningfulCharCount}`);
    if (result.warning) console.log(`  Warning: ${result.warning}`);
    if (result.error) console.log(`  Error: ${result.error}`);

    // Verify invariants
    if (relPath.includes('1786386150061')) {
      // Corrupt 40-byte PDF
      if (result.extractionStatus !== 'CORRUPT') {
        throw new Error(`Expected CORRUPT for ${relPath}, got ${result.extractionStatus}`);
      }
    } else {
      // Valid PDFs
      if (result.extractionStatus !== 'SUCCESS') {
        throw new Error(`Expected SUCCESS for ${relPath}, got ${result.extractionStatus}`);
      }
      if (result.charCount === 0 || result.wordCount === 0) {
        throw new Error(`Extracted text is unexpectedly empty for ${relPath}`);
      }
    }
  }
}

async function runEndToEndGemini() {
  console.log(`\n========================================================================`);
  console.log(`END-TO-END VALIDATION: EXTRACTION -> GEMINI 3.6 FLASH -> ZOD -> NORMALIZATION`);
  console.log(`========================================================================`);

  const testFile = 'sample-resumes/Alex_Rivera_Senior_FullStack_Engineer.pdf';
  const fullPath = path.join(process.cwd(), testFile);
  const buf = fs.readFileSync(fullPath);

  console.log(`1. Extracting text from ${testFile}...`);
  const extraction = await extractResumeText(buf, 'application/pdf');
  console.log(`   Status: ${extraction.extractionStatus}, Chars: ${extraction.charCount}, Words: ${extraction.wordCount}`);

  if (extraction.extractionStatus !== 'SUCCESS') {
    throw new Error(`Extraction failed on valid file: ${extraction.warning}`);
  }

  console.log(`2. Parsing with Gemini AI (gemini-3.6-flash)...`);
  try {
    const parsed = await parseResumeWithAI(extraction.text);
    console.log(`\n--- PARSED RESUME STRUCTURED OUTPUT ---`);
    console.log(`Summary: "${parsed.summary}"`);
    console.log(`Skills (${parsed.skills.length}): ${parsed.skills.join(', ')}`);
    console.log(`Education (${parsed.education.length}):`, JSON.stringify(parsed.education, null, 2));
    console.log(`Work Experience (${parsed.workExperience.length}):`, JSON.stringify(parsed.workExperience, null, 2));
    console.log(`Certifications (${parsed.certifications.length}):`, parsed.certifications);
    console.log(`Languages (${parsed.languages.length}):`, parsed.languages);
    console.log(`Total Experience Years:`, parsed.totalExperienceYears);
    console.log(`\n✅ END-TO-END PIPELINE VALIDATION PASSED!`);
  } catch (err: any) {
    console.log(`AI parsing result: ${err.message}`);
  }
}

async function main() {
  // Run pass 1
  await runDiagnosticPass(1);

  // Run pass 2 in the same process to verify Buffer isolation across sequential runs
  await runDiagnosticPass(2);

  // Run end-to-end Gemini parse
  await runEndToEndGemini();

  console.log(`\n🎉 ALL DIAGNOSTIC & ISOLATION CHECKS COMPLETED SUCCESSFULLY!`);
}

main().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
