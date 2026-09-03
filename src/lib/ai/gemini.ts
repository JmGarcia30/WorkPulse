import { GoogleGenerativeAI } from '@google/generative-ai';

let genAIInstance: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Google Gemini API is not configured. Please set GOOGLE_AI_API_KEY in your .env file.'
    );
  }
  if (!genAIInstance) {
    genAIInstance = new GoogleGenerativeAI(apiKey);
  }
  return genAIInstance;
}

/**
 * Get a configured Gemini model instance for resume parsing.
 * Uses gemini-3.5-flash-lite for low-latency, cost-effective structured extraction.
 */
export function getGeminiModel() {
  const ai = getGenAI();

  return ai.getGenerativeModel({
    model: 'gemini-3.5-flash-lite',
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  });
}



