import { RequirementType } from '@prisma/client';
import type { ParsedResumeData } from './parse-resume';

export interface JobRequirementInput {
  id: string;
  name: string;
  type: RequirementType;
  description: string | null;
  isRequired: boolean;
}

export interface MatchDetail {
  requirementId: string;
  requirementName: string;
  requirementType: RequirementType;
  isRequired: boolean;
  matched: boolean;
  confidence: 'high' | 'medium' | 'low';
  evidence: string;
}

export interface MatchResult {
  matchScore: number; // 0-100
  matchDetails: MatchDetail[];
}

/**
 * Normalize a string for fuzzy matching: lowercase, strip punctuation, collapse whitespace.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if a requirement name appears in a list of items using fuzzy substring matching.
 */
function fuzzyIncludes(items: string[], requirementName: string): {
  matched: boolean;
  evidence: string;
  confidence: 'high' | 'medium' | 'low';
} {
  const normalizedReq = normalize(requirementName);
  const normalizedItems = items.map(normalize);

  // Exact match
  for (let i = 0; i < normalizedItems.length; i++) {
    if (normalizedItems[i] === normalizedReq) {
      return {
        matched: true,
        evidence: items[i],
        confidence: 'high',
      };
    }
  }

  // Substring match (requirement is contained in item or vice versa)
  for (let i = 0; i < normalizedItems.length; i++) {
    if (
      normalizedItems[i].includes(normalizedReq) ||
      normalizedReq.includes(normalizedItems[i])
    ) {
      return {
        matched: true,
        evidence: items[i],
        confidence: 'high',
      };
    }
  }

  // Word-level overlap: check if any significant word from the requirement appears
  const reqWords = normalizedReq.split(' ').filter((w) => w.length > 2);
  for (let i = 0; i < normalizedItems.length; i++) {
    const itemWords = normalizedItems[i].split(' ');
    const matchingWords = reqWords.filter((rw) =>
      itemWords.some((iw) => iw.includes(rw) || rw.includes(iw))
    );

    if (matchingWords.length > 0) {
      const ratio = matchingWords.length / reqWords.length;
      if (ratio >= 0.5) {
        return {
          matched: true,
          evidence: items[i],
          confidence: ratio >= 0.8 ? 'high' : 'medium',
        };
      }
    }
  }

  return { matched: false, evidence: '', confidence: 'low' };
}

/**
 * Match a single SKILL requirement against parsed resume data.
 */
function matchSkillRequirement(
  parsed: ParsedResumeData,
  req: JobRequirementInput
): MatchDetail {
  const result = fuzzyIncludes(parsed.skills, req.name);

  return {
    requirementId: req.id,
    requirementName: req.name,
    requirementType: req.type,
    isRequired: req.isRequired,
    matched: result.matched,
    confidence: result.confidence,
    evidence: result.matched
      ? `Skill found: ${result.evidence}`
      : 'Skill not found in resume',
  };
}

/**
 * Match an EDUCATION requirement against parsed resume data.
 */
function matchEducationRequirement(
  parsed: ParsedResumeData,
  req: JobRequirementInput
): MatchDetail {
  const reqLower = normalize(req.name);

  for (const edu of parsed.education) {
    const combined = normalize(
      `${edu.degree} ${edu.fieldOfStudy} ${edu.institution}`
    );

    if (combined.includes(reqLower) || reqLower.includes(combined)) {
      return {
        requirementId: req.id,
        requirementName: req.name,
        requirementType: req.type,
        isRequired: req.isRequired,
        matched: true,
        confidence: 'high',
        evidence: `${edu.degree} in ${edu.fieldOfStudy} from ${edu.institution}`,
      };
    }

    // Check degree type match
    const degreeMatch = normalize(educationDegreeType(edu.degree));
    const reqWords = reqLower.split(' ');
    if (reqWords.some((w) => degreeMatch.includes(w) && w.length > 3)) {
      return {
        requirementId: req.id,
        requirementName: req.name,
        requirementType: req.type,
        isRequired: req.isRequired,
        matched: true,
        confidence: 'medium',
        evidence: `${edu.degree} in ${edu.fieldOfStudy}`,
      };
    }
  }

  return {
    requirementId: req.id,
    requirementName: req.name,
    requirementType: req.type,
    isRequired: req.isRequired,
    matched: false,
    confidence: 'low',
    evidence: 'No matching education found',
  };
}

function educationDegreeType(degree: string): string {
  if (/ph\.?d/i.test(degree)) return 'doctorate';
  if (/master/i.test(degree)) return 'master';
  if (/bachelor/i.test(degree)) return 'bachelor';
  if (/associate/i.test(degree)) return 'associate';
  return degree;
}

/**
 * Match an EXPERIENCE requirement against parsed resume data.
 */
function matchExperienceRequirement(
  parsed: ParsedResumeData,
  req: JobRequirementInput
): MatchDetail {
  // Check if total experience years meet the requirement
  const yearsMatch = req.name.match(/(\d+)\s*\+?\s*years?/i);

  if (yearsMatch && parsed.totalExperienceYears !== null) {
    const requiredYears = parseInt(yearsMatch[1], 10);
    const matched = parsed.totalExperienceYears >= requiredYears;

    return {
      requirementId: req.id,
      requirementName: req.name,
      requirementType: req.type,
      isRequired: req.isRequired,
      matched,
      confidence: matched ? 'high' : 'medium',
      evidence: matched
        ? `Candidate has ${parsed.totalExperienceYears} years of experience (requires ${requiredYears}+)`
        : `Candidate has ${parsed.totalExperienceYears} years (requires ${requiredYears}+)`,
    };
  }

  // Check work experience titles for relevant keywords
  const reqLower = normalize(req.name);
  const positions = parsed.workExperience.map((w) =>
    normalize(`${w.position} ${w.description}`)
  );

  const result = fuzzyIncludes(positions, reqNameWithoutYears(reqLower));

  return {
    requirementId: req.id,
    requirementName: req.name,
    requirementType: req.type,
    isRequired: req.isRequired,
    matched: result.matched,
    confidence: result.confidence,
    evidence: result.matched
      ? `Relevant experience: ${result.evidence}`
      : 'No matching work experience found',
  };
}

function reqNameWithoutYears(name: string): string {
  return name.replace(/\d+\s*\+?\s*years?/gi, '').trim();
}

/**
 * Match a CERTIFICATION requirement against parsed resume data.
 */
function matchCertificationRequirement(
  parsed: ParsedResumeData,
  req: JobRequirementInput
): MatchDetail {
  const result = fuzzyIncludes(parsed.certifications, req.name);

  return {
    requirementId: req.id,
    requirementName: req.name,
    requirementType: req.type,
    isRequired: req.isRequired,
    matched: result.matched,
    confidence: result.confidence,
    evidence: result.matched
      ? `Certification found: ${result.evidence}`
      : 'Certification not found in resume',
  };
}

/**
 * Match an OTHER requirement using generic text search across all fields.
 */
function matchOtherRequirement(
  parsed: ParsedResumeData,
  req: JobRequirementInput
): MatchDetail {
  const allText = [
    ...parsed.skills,
    ...parsed.certifications,
    ...parsed.languages,
    ...parsed.workExperience.map((w) => `${w.position} ${w.description}`),
    ...parsed.education.map((e) => `${e.degree} ${e.fieldOfStudy}`),
  ];

  const result = fuzzyIncludes(allText, req.name);

  return {
    requirementId: req.id,
    requirementName: req.name,
    requirementType: req.type,
    isRequired: req.isRequired,
    matched: result.matched,
    confidence: result.confidence,
    evidence: result.matched
      ? `Related match: ${result.evidence}`
      : 'No matching evidence found',
  };
}

/**
 * Score a parsed resume against a list of job requirements.
 * Returns a 0-100 match score and per-requirement details.
 */
export function scoreCandidateMatch(
  parsed: ParsedResumeData,
  requirements: JobRequirementInput[]
): MatchResult {
  if (requirements.length === 0) {
    return { matchScore: 100, matchDetails: [] };
  }

  const matchDetails: MatchDetail[] = requirements.map((req) => {
    switch (req.type) {
      case 'SKILL':
        return matchSkillRequirement(parsed, req);
      case 'EDUCATION':
        return matchEducationRequirement(parsed, req);
      case 'EXPERIENCE':
        return matchExperienceRequirement(parsed, req);
      case 'CERTIFICATION':
        return matchCertificationRequirement(parsed, req);
      default:
        return matchOtherRequirement(parsed, req);
    }
  });

  // Calculate weighted score
  // Required requirements carry 2x weight
  let totalWeight = 0;
  let matchedWeight = 0;

  for (const detail of matchDetails) {
    const weight = detail.isRequired ? 2 : 1;
    totalWeight += weight;
    if (detail.matched) {
      // High confidence = full weight, medium = 0.7, low = 0.3
      const confidenceMultiplier =
        detail.confidence === 'high'
          ? 1
          : detail.confidence === 'medium'
          ? 0.7
          : 0.3;
      matchedWeight += weight * confidenceMultiplier;
    }
  }

  const matchScore =
    totalWeight > 0
      ? Math.round((matchedWeight / totalWeight) * 100)
      : 100;

  return { matchScore: Math.min(100, Math.max(0, matchScore)), matchDetails };
}
