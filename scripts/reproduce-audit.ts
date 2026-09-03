import fs from 'fs';
import path from 'path';
import { extractResumeText } from '../src/lib/ai/extract-text';
import { getGeminiModel } from '../src/lib/ai/gemini';
import { parseResumeWithAI } from '../src/lib/ai/parse-resume';

// Load .env
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

async function runDiagnosis() {
  const sampleDir = path.join(process.cwd(), 'sample-resumes');
  const files = [
    'Alex_Rivera_Senior_FullStack_Engineer.pdf',
    'Elena_Santos_Senior_STEM_Educator.pdf',
    'Marcus_Vance_IT_Operations_Lead.pdf',
    'Sarah_Jenkins_Guidance_Counselor.pdf'
  ];

  console.log('========================================================================');
  console.log('WORKPULSE RESUME PARSING PIPELINE REPRODUCTION & DIAGNOSIS');
  console.log('========================================================================\n');

  for (const file of files) {
    const filePath = path.join(sampleDir, file);
    const buf = fs.readFileSync(filePath);
    console.log(`\n------------------------------------------------------------------------`);
    console.log(`FIXTURE: ${file}`);
    console.log(`1. File Type: PDF (${buf.length} bytes)`);

    // STEP 2 & 3: Extraction with current extractResumeText
    try {
      const extraction = await extractResumeText(buf, 'application/pdf');
      const charCount = extraction.charCount;
      const wordCount = extraction.wordCount;
      const extractedText = extraction.text;
      console.log(`2. Extracted Char Count: ${charCount}`);
      console.log(`3. Extracted Word Count: ${wordCount}`);
      console.log(`4. First 300 chars of extracted text:`);
      console.log(JSON.stringify(extractedText.slice(0, 300)));
      
      const hasSummary = /summary/i.test(extractedText);
      const hasExperience = /experience/i.test(extractedText);
      const hasEducation = /education/i.test(extractedText);
      const hasSkills = /skills/i.test(extractedText);
      console.log(`5. Major sections detected in extracted text:`);
      console.log(`   Summary: ${hasSummary}, Experience: ${hasExperience}, Education: ${hasEducation}, Skills: ${hasSkills}`);

      if (extraction.extractionStatus !== 'SUCCESS') {
        console.log(`⚠️ FAILED AT EXTRACTION: Status is ${extraction.extractionStatus}! (${charCount} chars)`);
        continue;
      }

      // STEP 6: Gemini call
      console.log(`6. Calling Gemini via parseResumeWithAI...`);
      const parsed = await parseResumeWithAI(extractedText);

      console.log(`   Summary length: ${parsed.summary.length}`);
      console.log(`   Skills count: ${parsed.skills.length} -> [${parsed.skills.slice(0, 5).join(', ')}...]`);
      console.log(`   Work Experience count: ${parsed.workExperience.length}`);
      console.log(`   Education count: ${parsed.education.length}`);
      console.log(`   Certifications count: ${parsed.certifications.length}`);
      console.log(`   Total Experience Years: ${parsed.totalExperienceYears} (type: ${typeof parsed.totalExperienceYears})`);
      console.log(`✅ PARSE SUCCEEDED for ${file}`);
    } catch (err: any) {
      console.log(`❌ ERROR on ${file}: ${err.message}`);
    }
  }
}

runDiagnosis().catch(e => console.error(e));
