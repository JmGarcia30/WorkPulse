const fs = require('fs');

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

async function testWithModel(modelName) {
  console.log(`\n================ Testing Model: ${modelName} ================`);
  const buf = fs.readFileSync('storage/resumes/seed-ana-reyes-resume.pdf');
  const extracted = await pdfParse(buf);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
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

  try {
    const res = await model.generateContent(prompt);
    const text = res.response.text();
    console.log('Success! Response length:', text.length);
    console.log('Snippet:', text.slice(0, 200));
    const parsed = JSON.parse(text);
    console.log('Skills count:', parsed.skills.length);
    console.log('Total exp:', parsed.totalExperienceYears);
  } catch (err) {
    console.error('Error with ' + modelName + ':', err.message);
  }
}

async function main() {
  await testWithModel('gemini-2.5-flash');
}
main();
