const fs = require('fs');
const pdfParse = require('pdf-parse/lib/pdf-parse.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Load API key from .env
const env = fs.readFileSync('.env', 'utf8');
let apiKey = '';
for (let line of env.split('\n')) {
  line = line.trim();
  if (line.startsWith('GOOGLE_AI_API_KEY=')) {
    apiKey = line.split('=')[1].replace(/[\"']/g, '').trim();
  }
}

async function testAllWithGemini(modelName) {
  console.log(`=======================================================`);
  console.log(`Testing Gemini extraction with model: ${modelName}`);
  console.log(`=======================================================\n`);

  const files = [
    'Alex_Rivera_Senior_FullStack_Engineer.pdf',
    'Elena_Santos_Senior_STEM_Educator.pdf',
    'Marcus_Vance_IT_Operations_Lead.pdf',
    'Sarah_Jenkins_Guidance_Counselor.pdf'
  ];

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  });

  const promptTemplate = `You are an expert HR resume parser. Extract structured data from the following resume text.
Return a JSON object with exactly this structure:
{
  "summary": "A 2-3 sentence professional summary",
  "skills": ["skill1", "skill2"],
  "education": [
    {
      "institution": "University/School Name",
      "degree": "Degree type",
      "fieldOfStudy": "Field of study",
      "startDate": "YYYY-MM or YYYY",
      "endDate": "YYYY-MM or YYYY or Present"
    }
  ],
  "workExperience": [
    {
      "company": "Company Name",
      "position": "Job Title",
      "startDate": "YYYY-MM or YYYY",
      "endDate": "YYYY-MM or YYYY or Present",
      "description": "Brief description of responsibilities"
    }
  ],
  "certifications": ["certification1"],
  "languages": ["language1"],
  "totalExperienceYears": 5
}
RESUME TEXT:
`;

  for (const f of files) {
    const raw = fs.readFileSync('sample-resumes/' + f);
    const copy = new Uint8Array(raw.byteLength);
    copy.set(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength));
    const extracted = await pdfParse(copy);
    console.log(`--- File: ${f} ---`);
    console.log(`Extracted chars: ${extracted.text.trim().length}`);

    try {
      const result = await model.generateContent(promptTemplate + extracted.text);
      const rawText = result.response.text();
      const parsed = JSON.parse(rawText);
      console.log(`Gemini Status: SUCCESS`);
      console.log(`Summary: "${parsed.summary?.slice(0, 80)}..."`);
      console.log(`Skills count: ${parsed.skills?.length}`);
      console.log(`Education count: ${parsed.education?.length}`);
      console.log(`Work Exp count: ${parsed.workExperience?.length}`);
      console.log(`Total Exp: ${parsed.totalExperienceYears} years\n`);
    } catch (err) {
      console.error(`Gemini FAILED for ${f}:`, err.message);
    }
  }
}

testAllWithGemini('gemini-3.6-flash');
