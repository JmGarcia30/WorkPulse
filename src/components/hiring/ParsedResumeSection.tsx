'use client';

import { useState } from 'react';
import {
  Sparkles,
  Brain,
  Briefcase,
  GraduationCap,
  Award,
  Globe,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { parseResumeAction } from '@/features/hiring/resume-parser-actions';

interface MatchDetail {
  requirementId: string;
  requirementName: string;
  requirementType: string;
  isRequired: boolean;
  matched: boolean;
  confidence: 'high' | 'medium' | 'low';
  evidence: string;
}

interface ParsedResumeProps {
  documentId: string;
  parsedResume: {
    summary: string | null;
    skills: string[];
    education: Array<{
      institution: string;
      degree: string;
      fieldOfStudy: string;
      startDate: string;
      endDate: string;
    }>;
    workExperience: Array<{
      company: string;
      position: string;
      startDate: string;
      endDate: string;
      description: string;
    }>;
    certifications: string[];
    languages: string[];
    totalExperienceYears: number | null;
    matchScore: number | null;
    matchDetails: MatchDetail[] | null;
    parsedAt: string;
    parseError: string | null;
  } | null;
  jobRequirements: Array<{
    id: string;
    name: string;
    type: string;
    isRequired: boolean;
  }>;
  canManage: boolean;
}

function MatchScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 75
      ? 'text-emerald-600 '
      : score >= 50
      ? 'text-amber-600 '
      : 'text-rose-600 ';

  const bgColor =
    score >= 75
      ? 'stroke-emerald-500'
      : score >= 50
      ? 'stroke-amber-500'
      : 'stroke-rose-500';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r="36"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-slate-100"
        />
        <circle
          cx="40"
          cy="40"
          r="36"
          fill="none"
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={bgColor}
        />
      </svg>
      <span
        className={`absolute text-sm font-bold ${color}`}
      >
        {score}%
      </span>
    </div>
  );
}

function RequirementBadge({
  detail,
}: {
  detail: MatchDetail;
}) {
  if (detail.matched) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        {detail.requirementName}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700">
      <AlertCircle className="h-3 w-3" />
      {detail.requirementName}
    </span>
  );
}

export function ParsedResumeSection({
  documentId,
  parsedResume,
  jobRequirements,
  canManage,
}: ParsedResumeProps) {
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localParsed, setLocalParsed] = useState(parsedResume);

  const handleParse = async () => {
    setParsing(true);
    setError(null);

    try {
      const result = await parseResumeAction(documentId);
      if ('error' in result && result.error) {
        setError(result.error);
      } else {
        // Reload the page to fetch fresh data
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to parse resume:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred while parsing the resume.'
      );
    } finally {
      setParsing(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--wp-border)] pb-4">
        <h3 className="text-sm font-bold text-[var(--wp-text-muted)] uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--wp-text)]" />
          AI-Assisted Resume Analysis
        </h3>
        {canManage && (
          <button
            onClick={handleParse}
            disabled={parsing}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--tenant-primary)] px-3.5 py-1.5 text-sm font-bold text-[var(--tenant-primary-foreground)] hover:brightness-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {parsing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Analyzing...
              </>
            ) : localParsed ? (
              <>
                <RefreshCw className="h-3.5 w-3.5" />
                Re-analyze
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                Analyze Resume
              </>
            )}
          </button>
        )}
      </div>

      {/* Assistive AI Disclaimer */}
      <div className="flex items-center gap-2.5 rounded-lg border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] p-3 text-xs text-[var(--wp-text)]">
        <Sparkles className="h-4 w-4 text-[var(--wp-text)] shrink-0" />
        <span>
          <strong>AI is Assistive Only:</strong> Extracted data and deterministic qualification scores assist human evaluation. All hiring and progression decisions are made by hiring team members.
        </span>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-md border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Parse Error from Server */}
      {localParsed?.parseError && !error && (
        <div className="flex items-center gap-2.5 rounded-md border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Last analysis note: {localParsed.parseError}</span>
        </div>
      )}

      {/* Empty State */}
      {!localParsed && !error && !parsing && (
        <div className="py-8 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">
            Resume has not been analyzed yet.
          </p>
          <p className="text-xs text-slate-400">
            Click &quot;Analyze Resume&quot; to extract structured data and calculate deterministic
            job requirement match.
          </p>
        </div>
      )}

      {/* Parsed Content */}
      {localParsed && !localParsed.parseError && (
        <div className="space-y-5">
          {/* Match Score + Summary */}
          <div className="flex gap-5 items-start">
            {localParsed.matchScore !== null && (
              <div className="shrink-0">
                <MatchScoreRing score={localParsed.matchScore} />
                <p className="mt-1 text-center text-xs font-semibold text-slate-500">
                  Job Requirement Match
                </p>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                AI-Assisted Resume Summary
              </h4>
              <p className="text-sm text-slate-700 leading-relaxed">
                {localParsed.summary}
              </p>
              {localParsed.totalExperienceYears !== null && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock className="h-3 w-3" />
                  {localParsed.totalExperienceYears} years of professional
                  experience
                </div>
              )}
            </div>
          </div>

          {/* Requirement Match Badges */}
          {localParsed.matchDetails &&
            localParsed.matchDetails.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Job Requirement Match
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {localParsed.matchDetails.map((detail) => (
                    <RequirementBadge key={detail.requirementId} detail={detail} />
                  ))}
                </div>
              </div>
            )}

          {/* Skills */}
          {localParsed.skills.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-[var(--wp-text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Brain className="h-3.5 w-3.5 text-[var(--wp-text)]" />
                Detected Skills ({localParsed.skills.length})
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {localParsed.skills.map((skill, i) => {
                  const isMatched = localParsed.matchDetails?.some(
                    (d) =>
                      d.matched &&
                      d.requirementType === 'SKILL' &&
                      d.evidence.toLowerCase().includes(skill.toLowerCase())
                  );
                  return (
                    <span
                      key={i}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        isMatched
                          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 '
                          : 'bg-[var(--wp-surface-subtle)] text-[var(--wp-text)] border border-[var(--wp-border)] '
                      }`}
                    >
                      {skill}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Work Experience */}
          {localParsed.workExperience.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-[var(--wp-text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Briefcase className="h-3.5 w-3.5 text-[var(--wp-text)]" />
                Work Experience
              </h4>
              <div className="space-y-2.5">
                {localParsed.workExperience.map((exp, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] p-3.5"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-bold text-[var(--wp-text)]">
                          {exp.position}
                        </p>
                        <p className="text-xs text-[var(--wp-text-muted)]">
                          {exp.company}
                        </p>
                      </div>
                      <span className="text-xs text-[var(--wp-text-muted)] whitespace-nowrap font-medium">
                        {exp.startDate} — {exp.endDate}
                      </span>
                    </div>
                    {exp.description && (
                      <p className="mt-1.5 text-xs text-[var(--wp-text-muted)] leading-relaxed">
                        {exp.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {localParsed.education.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-[var(--wp-text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5 text-[var(--wp-text)]" />
                Education
              </h4>
              <div className="space-y-2">
                {localParsed.education.map((edu, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-[var(--wp-border)] bg-[var(--wp-surface-subtle)] p-3.5"
                  >
                    <p className="text-sm font-bold text-[var(--wp-text)]">
                      {edu.degree}
                      {edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ''}
                    </p>
                    <p className="text-xs text-[var(--wp-text-muted)]">
                      {edu.institution}
                    </p>
                    <p className="text-xs text-[var(--wp-text-muted)] mt-0.5 font-medium">
                      {edu.startDate} — {edu.endDate}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Certifications + Languages (side by side) */}
          <div className="grid gap-4 sm:grid-cols-2">
            {localParsed.certifications.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-[var(--wp-text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5 text-[var(--wp-text)]" />
                  Certifications
                </h4>
                <ul className="space-y-1">
                  {localParsed.certifications.map((cert, i) => (
                    <li
                      key={i}
                      className="text-xs text-[var(--wp-text)] flex items-start gap-1.5"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--tenant-primary)] shrink-0" />
                      {cert}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {localParsed.languages.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-[var(--wp-text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-[var(--wp-text)]" />
                  Languages
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {localParsed.languages.map((lang, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-[var(--wp-surface-subtle)] border border-[var(--wp-border)] px-2.5 py-0.5 text-xs font-semibold text-[var(--wp-text)]"
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Parsed Timestamp */}
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-400">
              Parsed on{' '}
              {new Date(localParsed.parsedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
