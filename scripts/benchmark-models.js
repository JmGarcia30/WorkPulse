const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const env = fs.readFileSync('.env', 'utf8');
let apiKey = '';
for (let line of env.split('\n')) {
  line = line.trim();
  if (line.startsWith('GOOGLE_AI_API_KEY=')) {
    apiKey = line.split('=')[1].replace(/[\"']/g, '').trim();
  }
}

const resumeText = `Alex Rivera
Senior Full-Stack Engineer with 6 years experience in TypeScript, React, Next.js, Node.js, AWS, Docker.
Education: UC Berkeley, B.S. in CS (2015-2019)
Experience:
- NovaTech Solutions, Lead Developer (2022-03 to Present): Built Next.js microservices.
- Apex Cloud Labs, Senior Engineer (2019-06 to 2022-02): Built React dashboards.`;

const prompt = `Extract JSON: {"summary":"","skills":[],"education":[],"workExperience":[],"certifications":[],"languages":[],"totalExperienceYears":0}\n\nRESUME:\n` + resumeText;

async function testModel(modelName) {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  });

  const start = Date.now();
  try {
    const res = await model.generateContent(prompt);
    const text = res.response.text();
    const duration = Date.now() - start;
    console.log(`✓ ${modelName.padEnd(25)} -> ${duration}ms (output length: ${text.length})`);
  } catch (err) {
    const duration = Date.now() - start;
    console.log(`❌ ${modelName.padEnd(25)} -> ${duration}ms: ${err.message}`);
  }
}

async function run() {
  console.log('Testing model latency:');
  for (const m of ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite', 'gemini-2.5-flash']) {
    await testModel(m);
  }
}

run();
