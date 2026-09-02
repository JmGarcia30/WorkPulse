export interface ParsedEducation {
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
}

export interface ParsedWorkExperience {
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface ParsedResumeData {
  summary: string;
  skills: string[];
  education: ParsedEducation[];
  workExperience: ParsedWorkExperience[];
  certifications: string[];
  languages: string[];
  totalExperienceYears: number | null;
}

import { getGeminiModel } from './gemini';

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

/**
 * Send resume text to Gemini AI and extract structured data.
 */
export async function parseResumeWithAI(
  rawText: string
): Promise<ParsedResumeData> {
  const model = getGeminiModel();

  const result = await model.generateContent(PARSE_PROMPT + rawText);
  const response = result.response;
  const text = response.text();

  // Parse the JSON response
  let parsed: ParsedResumeData;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      'Failed to parse AI response as JSON. The resume may be unreadable or in an unsupported format.'
    );
  }

  // Validate and normalize the parsed data
  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    skills: Array.isArray(parsed.skills)
      ? parsed.skills.filter((s): s is string => typeof s === 'string')
      : [],
    education: Array.isArray(parsed.education) ? parsed.education : [],
    workExperience: Array.isArray(parsed.workExperience)
      ? parsed.workExperience
      : [],
    certifications: Array.isArray(parsed.certifications)
      ? parsed.certifications.filter((c): c is string => typeof c === 'string')
      : [],
    languages: Array.isArray(parsed.languages)
      ? parsed.languages.filter((l): l is string => typeof l === 'string')
      : [],
    totalExperienceYears:
      typeof parsed.totalExperienceYears === 'number'
        ? parsed.totalExperienceYears
        : null,
  };
}
