import 'server-only';
import { emailOrganizationName, renderBrandedEmail, publicEmailLogoUrl, type BrandedEmailContent, type EmailBranding } from './test-email-template';

export const HR_EMAIL_TYPES = ['acknowledgment', 'interview', 'acceptance', 'rejection', 'onboarding'] as const;
export type HrEmailType = typeof HR_EMAIL_TYPES[number];
export const HR_EMAIL_LABELS: Record<HrEmailType, string> = {
  acknowledgment: 'Applicant acknowledgment', interview: 'Interview invitation', acceptance: 'Successful applicant notification', rejection: 'Rejection notification', onboarding: 'Employee onboarding',
};
export type HrEmailDetails = {
  recipientName?: string; jobTitle?: string; portalUrl?: string; instructions?: string[];
  scheduledAt?: string; timeZone?: string; durationMinutes?: number; location?: string;
  meetingUrl?: string; interviewerName?: string; startDate?: string; contactEmail?: string;
};

function dateLabel(value: string | undefined, zone: string, includeTime = false) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  try { return new Intl.DateTimeFormat('en', { dateStyle: 'long', ...(includeTime ? { timeStyle: 'short' as const } : {}), timeZone: includeTime ? zone : 'UTC' }).format(date) + (includeTime ? ` (${zone})` : ''); }
  catch { return dateLabel(value, 'UTC', includeTime); }
}
export function renderHrEmail(branding: EmailBranding, type: HrEmailType, details: HrEmailDetails = {}) {
  const name = emailOrganizationName(branding), position = details.jobTitle?.trim();
  const role = position ? `the ${position} position` : 'the position you applied for';
  const greeting = details.recipientName?.trim() ? `Dear ${details.recipientName.trim()},` : 'Hello,';
  const zone = details.timeZone || branding.timeZone || 'UTC';
  const schedule = dateLabel(details.scheduledAt, zone, true), start = dateLabel(details.startDate, zone);
  const content: BrandedEmailContent = { subject: '', greeting, paragraphs: [], hrDepartment: true, signature: true };
  switch (type) {
    case 'acknowledgment':
      content.subject = `Application Received${position ? ': ' + position : ''} — ${name}`;
      content.paragraphs = [`Thank you for applying for ${role} at ${name}. We have received your application.`, 'Our Human Resources team will review your application and contact you regarding any next steps.'];
      break;
    case 'interview':
      content.subject = `Interview invitation${position ? ': ' + position : ''} — ${name}`;
      content.paragraphs = [`We would like to invite you to an interview for ${role} at ${name}.`, schedule ? 'Please review the interview details below and contact our Human Resources team if you need to discuss the arrangements.' : 'Please contact our Human Resources team to confirm the interview schedule and arrangements.'];
      content.details = [{ label: 'Date and time', value: schedule }, { label: 'Duration', value: details.durationMinutes && details.durationMinutes > 0 ? `${details.durationMinutes} minutes` : '' }, { label: 'Location', value: details.location?.trim() || '' }, { label: 'Interviewer', value: details.interviewerName?.trim() || '' }];
      if (publicEmailLogoUrl(details.meetingUrl)) content.action = { label: 'Join the interview', url: details.meetingUrl! };
      break;
    case 'acceptance':
      content.subject = `Application successful${position ? ': ' + position : ''} — ${name}`;
      content.paragraphs = [`We are pleased to let you know that your application for ${role} at ${name} has been successful.`, 'Our Human Resources team will confirm the next steps and any formal offer or onboarding arrangements with you.'];
      break;
    case 'rejection':
      content.subject = `Application update${position ? ': ' + position : ''} — ${name}`;
      content.paragraphs = [`Thank you for your interest in ${role} at ${name} and for the time you have invested in your application.`, 'After careful consideration, we will not be progressing your application for this position. We appreciate your interest and wish you well in your future opportunities.'];
      break;
    case 'onboarding':
      content.subject = `Welcome and onboarding information — ${name}`;
      content.paragraphs = [`Welcome to ${name}${position ? ' as ' + position : ''}. We look forward to working with you.`, 'Please review the onboarding information below. Contact our Human Resources team if you have any questions or need assistance.'];
      content.details = [{ label: 'Start date', value: start }, { label: 'Location', value: details.location?.trim() || '' }];
      break;
  }
  if (type === 'acceptance' && start) content.details = [{ label: 'Planned start date', value: start }];
  if (details.instructions?.length) content.paragraphs.push(...details.instructions.map(item => item.trim()).filter(Boolean));
  if (!content.action && type !== 'rejection' && publicEmailLogoUrl(details.portalUrl)) content.action = { label: type === 'onboarding' ? 'View onboarding information' : 'View your application', url: details.portalUrl! };
  if (details.contactEmail?.trim()) content.details = [...(content.details || []), { label: 'HR contact', value: details.contactEmail.trim() }];
  return renderBrandedEmail(branding, content);
}

// Preview fixtures only: no real people, credentials, application records or sends.
export function mockHrEmailDetails(): HrEmailDetails {
  return { recipientName: 'Jamie Rivera', jobTitle: 'Administrative Assistant', scheduledAt: '2026-11-12T02:00:00.000Z', timeZone: 'Asia/Manila', durationMinutes: 45, location: 'Main office, meeting room 2', meetingUrl: 'https://example.invalid/mock-interview', interviewerName: 'Morgan Reyes, HR Officer', startDate: '2026-11-23T00:00:00.000Z', instructions: ['Please contact the HR team to confirm the arrangements and any documents you need to prepare.'], portalUrl: 'https://example.invalid/mock-workspace', contactEmail: 'hr@example.invalid' };
}
