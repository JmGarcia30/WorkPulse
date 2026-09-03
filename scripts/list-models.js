const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
let apiKey = '';
for (let line of env.split('\n')) {
  line = line.trim();
  if (line.startsWith('GOOGLE_AI_API_KEY=')) {
    apiKey = line.split('=')[1].replace(/[\"']/g, '').trim();
  }
}

async function listModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.models) {
    console.log('Available models count:', data.models.length);
    const supported = data.models
      .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
      .map(m => m.name);
    console.log('Supported for generateContent:', supported);
  } else {
    console.log('Response:', data);
  }
}

listModels();
