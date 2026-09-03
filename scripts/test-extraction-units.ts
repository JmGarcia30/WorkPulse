import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  extractResumeText,
  normalizeExtractedText,
  evaluateExtractionQuality
} from '../src/lib/ai/extract-text';
import { ParsedResumeSchema } from '../src/lib/ai/parse-resume';

async function runUnitTests() {
  console.log('========================================================================');
  console.log('UNIT TESTS: TEXT EXTRACTION, NORMALIZATION & VALIDATION');
  console.log('========================================================================\n');

  // Test 1: Normalization
  console.log('1. Testing text normalization...');
  const dirty = 'Hello \x00 world!\r\n\r\n\r\n\r\nSection 1:\t\t• Skill 1   \n\n\n\n• Skill 2  \x1F';
  const clean = normalizeExtractedText(dirty);
  assert(!clean.includes('\x00'), 'Null bytes should be removed');
  assert(!clean.includes('\x1F'), 'Control characters should be removed');
  assert(!clean.includes('\r'), 'Carriage returns should be normalized to LF');
  assert(!clean.includes('\n\n\n'), 'Consecutive blank lines should be collapsed');
  assert(clean.includes('• Skill 1'), 'Bullets should be preserved');
  console.log('   ✓ Normalization tests passed.');

  // Test 2: Quality Evaluation
  console.log('\n2. Testing quality evaluation...');
  const emptyRes = evaluateExtractionQuality('', 'PDF');
  assert.strictEqual(emptyRes.status, 'EMPTY', 'Empty string must be EMPTY');

  const whitespaceRes = evaluateExtractionQuality('   \n\n   \t  ', 'PDF');
  assert.strictEqual(whitespaceRes.status, 'EMPTY', 'Whitespace-only must be EMPTY');

  const nonMeaningful = evaluateExtractionQuality('... --- ... ___ +++', 'PDF');
  assert.strictEqual(nonMeaningful.status, 'EMPTY', 'Punctuation-only must be EMPTY');

  const validText = evaluateExtractionQuality('Alex Rivera\nSenior Full-Stack Software Engineer with 8 years experience in TypeScript and React.', 'PDF');
  assert.strictEqual(validText.status, 'SUCCESS', 'Valid resume text must be SUCCESS');
  console.log('   ✓ Quality evaluation tests passed.');

  // Test 3: Schema Validation
  console.log('\n3. Testing Zod ParsedResumeSchema validation & normalization...');
  const rawAiJson = {
    summary: '  Experienced engineer with strong background in cloud architecture.  ',
    skills: ['TypeScript', 'React', 'TypeScript', '  Node.js  ', ''],
    education: [
      {
        institution: ' MIT ',
        degree: ' B.S. ',
        fieldOfStudy: ' CS ',
        startDate: ' 2014 ',
        endDate: ' 2018 '
      }
    ],
    workExperience: [
      {
        company: ' Google ',
        position: ' Engineer ',
        startDate: ' 2018-05 ',
        endDate: ' Present ',
        description: ' Built distributed systems '
      }
    ],
    certifications: [' AWS ', 'AWS', ''],
    languages: [' English ', ' Spanish '],
    totalExperienceYears: '5.5'
  };

  const parsed = ParsedResumeSchema.safeParse(rawAiJson);
  assert(parsed.success, 'Valid JSON should parse successfully');
  if (parsed.success) {
    assert.strictEqual(parsed.data.totalExperienceYears, 5.5, 'totalExperienceYears string should parse to float');
  }
  console.log('   ✓ Schema validation tests passed.');

  // Test 4: DOCX extraction test
  console.log('\n4. Testing DOCX / Unsupported handling...');
  const unsupportedRes = await extractResumeText(Buffer.from('test'), 'image/png');
  assert.strictEqual(unsupportedRes.extractionStatus, 'UNSUPPORTED');
  console.log('   ✓ Unsupported MIME type test passed.');

  console.log('\n🎉 ALL UNIT TESTS PASSED SUCCESSFULLY!');
}

runUnitTests().catch((err) => {
  console.error('\n❌ Unit test failed:', err);
  process.exit(1);
});
