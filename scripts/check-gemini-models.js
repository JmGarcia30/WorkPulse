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

async function test() {
  const genAI = new GoogleGenerativeAI(apiKey);
  for (const m of ['gemini-3.6-flash', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash']) {
    try {
      const model = genAI.getGenerativeModel({ model: m });
      const res = await model.generateContent('Say hello in 2 words');
      console.log('Model', m, '-> SUCCESS:', res.response.text().trim());
    } catch (e) {
      console.log('Model', m, '-> ERROR:', e.message);
    }
  }
}
test();
