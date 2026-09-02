import fs from 'fs';
import path from 'path';
import { extractResumeText } from '../src/lib/ai/extract-text';
import { parseResumeWithAI } from '../src/lib/ai/parse-resume';

async function main() {
  console.log('=============================================');
  console.log('      Resume Parsing Pipeline Test           ');
  console.log('=============================================\n');

  console.log('Step 1: Checking GOOGLE_AI_API_KEY in environment...');
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) {
    console.error('❌ GOOGLE_AI_API_KEY is not set in .env!');
    return;
  }
  console.log(`✓ API Key found (starts with: ${key.substring(0, 6)}...)\n`);

  console.log('Step 2: Testing PDF Text Extraction...');
  const filePath = path.join(process.cwd(), 'storage', 'resumes', 'seed-ana-reyes-resume.pdf');
  if (!fs.existsSync(filePath)) {
    console.error(`❌ PDF file not found at: ${filePath}`);
    return;
  }
  const buffer = fs.readFileSync(filePath);
  const text = await extractResumeText(buffer, 'application/pdf');
  console.log(`✓ Text extracted successfully! (${text.length} characters)\n`);

  console.log('Step 3: Sending extracted text to Gemini AI model (gemini-1.5-flash)...');
  const parsed = await parseResumeWithAI(text);

  console.log('\n=============================================');
  console.log('✅ SUCCESS! Resume parsed by Gemini:');
  console.log('=============================================');
  console.log('Summary:');
  console.log(`  "${parsed.summary}"\n`);
  console.log(`Skills Extracted (${parsed.skills.length}):`);
  console.log(`  ${parsed.skills.join(', ')}\n`);
  console.log(`Experience (${parsed.workExperience.length} positions, ~${parsed.totalExperienceYears} years):`);
  parsed.workExperience.forEach((exp) => {
    console.log(`  • ${exp.position} at ${exp.company} (${exp.startDate} - ${exp.endDate})`);
  });
  console.log('\nEducation:');
  parsed.education.forEach((edu) => {
    console.log(`  • ${edu.degree} in ${edu.fieldOfStudy} (${edu.institution})`);
  });
  console.log('=============================================');
}

main().catch((err) => {
  console.error('\n❌ Pipeline Test Failed:');
  console.error(err.message || err);
});
