import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.GOOGLE_AI_API_KEY;

if (!API_KEY) {
  console.warn(
    'GOOGLE_AI_API_KEY is not set. Resume parsing will not work until it is configured.'
  );
}

const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

/**
 * Get a configured Gemini model instance for resume parsing.
 * Uses gemini-3.6-flash for fast, cost-effective structured extraction.
 */
export function getGeminiModel() {
  if (!genAI) {
    throw new Error(
      'Google Gemini API is not configured. Please set GOOGLE_AI_API_KEY in your .env file.'
    );
  }

  return genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
    },
  });
}
