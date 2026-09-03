import { z } from 'zod';
import { getGeminiModel } from './gemini';

export const ParsedEducationSchema = z.object({
  institution: z.string().default(''),
  degree: z.string().default(''),
  fieldOfStudy: z.string().default(''),
  startDate: z.string().default(''),
  endDate: z.string().default(''),
});

export const ParsedWorkExperienceSchema = z.object({
  company: z.string().default(''),
  position: z.string().default(''),
  startDate: z.string().default(''),
  endDate: z.string().default(''),
  description: z.string().default(''),
});

export const ParsedResumeSchema = z.object({
  summary: z.string().default(''),
  skills: z.array(z.string()).default([]),
  education: z.array(ParsedEducationSchema).default([]),
  workExperience: z.array(ParsedWorkExperienceSchema).default([]),
  certifications: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([]),
  totalExperienceYears: z
    .union([z.number(), z.string()])
    .nullable()
    .optional()
    .transform((val) => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'number') {
        return isNaN(val) || val < 0 ? null : Math.round(val * 10) / 10;
      }
      const parsed = parseFloat(val);
      return isNaN(parsed) || parsed < 0 ? null : Math.round(parsed * 10) / 10;
    }),
});

export type ParsedEducation = z.infer<typeof ParsedEducationSchema>;
export type ParsedWorkExperience = z.infer<typeof ParsedWorkExperienceSchema>;
export type ParsedResumeData = z.infer<typeof ParsedResumeSchema>;

export class ResumeParserError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'ResumeParserError';
    this.code = code;
  }
}

const PARSE_PROMPT = `You are an expert HR resume parser. Extract structured data from the following resume text.

Return a JSON object with exactly this structure:
{
  "summary": "A 2-3 sentence professional summary of the candidate's profile, experience level, and key strengths",
  "skills": ["skill1", "skill2", ...],
  "education": [
    {
      "institution": "University/School Name",
      "degree": "Degree type (e.g., Bachelor of Science, Master of Arts)",
      "fieldOfStudy": "Field of study (e.g., Computer Science, Education)",
      "startDate": "YYYY-MM or YYYY",
      "endDate": "YYYY-MM or YYYY or Present"
    }
  ],
  "workExperience": [
    {
      "company": "Company/Organization Name",
      "position": "Job Title",
      "startDate": "YYYY-MM or YYYY",
      "endDate": "YYYY-MM or YYYY or Present",
      "description": "Brief description of responsibilities and achievements"
    }
  ],
  "certifications": ["certification1", "certification2", ...],
  "languages": ["language1", "language2", ...],
  "totalExperienceYears": 5
}

Rules:
- Extract ALL skills mentioned anywhere in the resume (technical skills, soft skills, tools, frameworks, methodologies)
- For dates, use "YYYY-MM" format when month is available, otherwise "YYYY"
- Use "Present" for current positions/education
- totalExperienceYears should be the estimated total years of professional work experience (not education). If unclear, make a reasonable estimate.
- If a field is not found in the resume, use an empty array [] for lists, empty string "" for text, and null for numbers
- Do NOT fabricate information that is not in the resume
- Keep skills as specific as possible (e.g., "React.js" not just "JavaScript frameworks")

RESUME TEXT:
`;

async function callGeminiWithRetry(
  prompt: string,
  maxRetries = 3
): Promise<string> {
  const model = getGeminiModel();
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      return response.text();
    } catch (err: unknown) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      const isRetryable =
        message.includes('503') ||
        message.includes('429') ||
        message.includes('high demand') ||
        message.includes('temporarily unavailable') ||
        message.includes('ResourceExhausted') ||
        message.includes('ECONNRESET') ||
        message.includes('ETIMEDOUT');

      if (isRetryable && attempt < maxRetries) {
        const delayMs = attempt * 1000;
        console.warn(
          `[Gemini API Warning] Attempt ${attempt} failed with retryable error (${message}). Retrying in ${delayMs}ms...`
        );
        await new Promise((res) => setTimeout(res, delayMs));
        continue;
      }
      break;
    }
  }

  const finalMsg =
    lastError instanceof Error ? lastError.message : String(lastError);
  console.error(`[Gemini API Error]: ${finalMsg}`);
  throw new ResumeParserError(
    `Gemini AI service error: ${finalMsg}`,
    'GEMINI_API_ERROR'
  );
}

/**
 * Send resume text to Gemini AI and extract structured data.
 */
export async function parseResumeWithAI(
  rawText: string
): Promise<ParsedResumeData> {
  const responseText = await callGeminiWithRetry(PARSE_PROMPT + rawText);


  // Parse JSON response
  let rawParsed: unknown;
  try {
    const cleaned = responseText
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '');
    rawParsed = JSON.parse(cleaned);
  } catch {
    console.error(`[Gemini Invalid JSON Response]: ${responseText}`);
    throw new ResumeParserError(
      'Failed to parse AI response as valid JSON.',
      'GEMINI_INVALID_RESPONSE'
    );
  }

  // Validate with Zod schema
  const validation = ParsedResumeSchema.safeParse(rawParsed);
  if (!validation.success) {
    console.error(
      `[Gemini Schema Validation Error]:`,
      validation.error.flatten()
    );
    throw new ResumeParserError(
      `AI response failed schema validation: ${validation.error.message}`,
      'GEMINI_INVALID_RESPONSE'
    );
  }

  const data = validation.data;

  // Normalize extracted fields
  return {
    summary: data.summary.trim(),
    skills: Array.from(
      new Set(
        data.skills
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && s.length <= 100)
      )
    ),
    education: data.education.map((edu) => ({
      institution: edu.institution.trim(),
      degree: edu.degree.trim(),
      fieldOfStudy: edu.fieldOfStudy.trim(),
      startDate: edu.startDate.trim(),
      endDate: edu.endDate.trim(),
    })),
    workExperience: data.workExperience.map((exp) => ({
      company: exp.company.trim(),
      position: exp.position.trim(),
      startDate: exp.startDate.trim(),
      endDate: exp.endDate.trim(),
      description: exp.description.trim(),
    })),
    certifications: Array.from(
      new Set(
        data.certifications
          .map((c) => c.trim())
          .filter((c) => c.length > 0)
      )
    ),
    languages: Array.from(
      new Set(
        data.languages
          .map((l) => l.trim())
          .filter((l) => l.length > 0)
      )
    ),
    totalExperienceYears: data.totalExperienceYears ?? null,
  };
}

