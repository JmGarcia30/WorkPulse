const fs = require('fs');
const path = require('path');

// Read .env
const env = fs.readFileSync('.env', 'utf8');
let apiKey = '';
for (let line of env.split('\n')) {
  line = line.trim();
  if (line.startsWith('GOOGLE_AI_API_KEY=')) {
    apiKey = line.split('=')[1].replace(/[\"']/g, '').trim();
  }
}
process.env.GOOGLE_AI_API_KEY = apiKey;

const pdfParse = require('pdf-parse/lib/pdf-parse.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGeminiReal() {
  const buf = fs.readFileSync('storage/resumes/seed-ana-reyes-resume.pdf');
  const extracted = await pdfParse(buf);
  console.log('1. Extracted text chars:', extracted.text.length);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  });

  const prompt = `You are an expert HR resume parser. Extract structured data from the following resume text.
Return a JSON object with this structure:
{
  "summary": "professional summary",
  "skills": ["skill1"],
  "education": [{"institution": "name", "degree": "deg", "fieldOfStudy": "field", "startDate": "YYYY", "endDate": "YYYY"}],
  "workExperience": [{"company": "name", "position": "title", "startDate": "YYYY", "endDate": "YYYY", "description": "desc"}],
  "certifications": ["cert1"],
  "languages": ["lang1"],
  "totalExperienceYears": 5
}
RESUME TEXT:
` + extracted.text;

  console.log('2. Sending request to Gemini...');
  try {
    const res = await model.generateContent(prompt);
    const text = res.response.text();
    console.log('3. Raw Gemini response text length:', text.length);
    console.log('4. Raw Gemini response snippet:');
    console.log(text.slice(0, 400));
    
    const parsed = JSON.parse(text);
    console.log('5. Parsed JSON keys:', Object.keys(parsed));
    console.log('6. Skills:', parsed.skills);
    console.log('7. Work experience:', parsed.workExperience);
    console.log('8. Total Experience Years:', parsed.totalExperienceYears, 'type:', typeof parsed.totalExperienceYears);
  } catch (err) {
    console.error('Gemini error:', err);
  }
}

testGeminiReal();
