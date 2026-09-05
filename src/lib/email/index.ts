import nodemailer from 'nodemailer';

export interface EmailLogEntry {
  id: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  sentAt: Date;
  mode: 'smtp' | 'preview_log';
}

// In-memory cache for development, testing, and capstone presentation inspection
const emailLogQueue: EmailLogEntry[] = [];

export function getEmailLogs(): EmailLogEntry[] {
  return [...emailLogQueue];
}

export function clearEmailLogs(): void {
  emailLogQueue.length = 0;
}

export function getLastSentEmail(): EmailLogEntry | undefined {
  return emailLogQueue[emailLogQueue.length - 1];
}

/**
 * Creates a transporter instance if credentials exist in environment variables.
 * Free Gmail SMTP requires a standard Gmail address and an App Password (zero cost).
 */
function getTransporter() {
  const user = process.env.GMAIL_USER || process.env.SMTP_USER;
  const pass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASSWORD;

  if (user && pass) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }

  return null;
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailParams): Promise<{ success: boolean; mode: 'smtp' | 'preview_log'; id: string }> {
  const plainText = text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const id = `email_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const transporter = getTransporter();

  if (transporter) {
    try {
      const fromAddress = process.env.EMAIL_FROM || process.env.GMAIL_USER || 'no-reply@workpulse.saga.edu';
      await transporter.sendMail({
        from: `"WorkPulse — St. Aloysius Gonzaga Academy" <${fromAddress}>`,
        to,
        subject,
        text: plainText,
        html,
      });

      const entry: EmailLogEntry = { id, to, subject, text: plainText, html, sentAt: new Date(), mode: 'smtp' };
      emailLogQueue.push(entry);
      console.log(`[WorkPulse Emailer (SMTP)] Dispatched to ${to} | Subject: "${subject}"`);
      return { success: true, mode: 'smtp', id };
    } catch (error) {
      console.warn(`[WorkPulse Emailer] SMTP delivery failed. Falling back to preview log:`, error);
    }
  }

  // Preview / Development / Defense mode (Zero-cost, 100% reliable offline)
  const entry: EmailLogEntry = { id, to, subject, text: plainText, html, sentAt: new Date(), mode: 'preview_log' };
  emailLogQueue.push(entry);

  console.log(`\n================== [WORKPULSE TRANSACTIONAL EMAIL] ==================`);
  console.log(`ID:      ${id}`);
  console.log(`TO:      ${to}`);
  console.log(`SUBJECT: ${subject}`);
  console.log(`TIME:    ${entry.sentAt.toISOString()}`);
  console.log(`BODY PREVIEW:\n${plainText.slice(0, 300)}...`);
  console.log(`=====================================================================\n`);

  return { success: true, mode: 'preview_log', id };
}

// ==========================================
// INSTITUTIONAL SAGA EMAIL TEMPLATES
// ==========================================

export async function sendApplicationConfirmationEmail({
  to,
  candidateName,
  jobTitle,
  organizationName,
  organizationSlug,
  applicationId,
  baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
}: {
  to: string;
  candidateName: string;
  jobTitle: string;
  organizationName: string;
  organizationSlug: string;
  applicationId: string;
  baseUrl?: string;
}) {
  const portalUrl = `${baseUrl}/careers/${organizationSlug}/portal/${applicationId}`;
  const subject = `Application Received: ${jobTitle} — ${organizationName}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
      <div style="padding-bottom: 16px; border-bottom: 2px solid #2563eb;">
        <h2 style="margin: 0; color: #1e293b; font-size: 20px;">${organizationName}</h2>
        <p style="margin: 4px 0 0; color: #64748b; font-size: 13px;">Faculty & Staff Recruitment Division</p>
      </div>

      <div style="padding: 24px 0;">
        <h3 style="margin: 0 0 12px; font-size: 18px; color: #0f172a;">Dear ${candidateName},</h3>
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px;">
          Thank you for applying for the position of <strong>${jobTitle}</strong> at ${organizationName}. Your application and initial credentials have been registered in our institutional hiring database.
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h4 style="margin: 0 0 8px; font-size: 14px; color: #1e293b;">Next Step: Submit Required SAGA Credentials</h4>
          <p style="font-size: 13px; line-height: 1.5; color: #475569; margin: 0 0 12px;">
            In accordance with the <strong>SAGA Institutional Hiring Policy</strong>, all applicants must submit verified credential copies (Transcript of Records, Diploma, Board LET license, 3 Moral Recommendation Letters, and NBI Clearance) to the Head of the Department.
          </p>
          <p style="font-size: 13px; line-height: 1.5; color: #475569; margin: 0;">
            You can upload your scanned credentials directly through your dedicated Candidate Document Portal.
          </p>
        </div>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${portalUrl}" style="background-color: #2563eb; color: #ffffff; font-weight: 600; font-size: 14px; padding: 12px 28px; text-decoration: none; border-radius: 8px; display: inline-block;">
            Access Your Candidate Document Portal &rarr;
          </a>
        </div>

        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
          Or copy and paste this secure link into your browser:<br/>
          <span style="color: #2563eb; word-break: break-all;">${portalUrl}</span>
        </p>
      </div>

      <div style="padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
        <p style="margin: 0;">This is an automated operational notification from St. Aloysius Gonzaga Academy, Inc. Hiring System.</p>
      </div>
    </div>
  `;

  return sendEmail({ to, subject, html });
}

export async function sendDocumentRejectedEmail({
  to,
  candidateName,
  documentTitle,
  rejectionReason,
  portalUrl,
  organizationName,
}: {
  to: string;
  candidateName: string;
  documentTitle: string;
  rejectionReason: string;
  portalUrl: string;
  organizationName: string;
}) {
  const subject = `Action Required: Document Resubmission Requested (${documentTitle}) — ${organizationName}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
      <div style="padding-bottom: 16px; border-bottom: 2px solid #dc2626;">
        <h2 style="margin: 0; color: #1e293b; font-size: 20px;">${organizationName}</h2>
        <p style="margin: 4px 0 0; color: #dc2626; font-weight: 600; font-size: 13px;">Document Review Notice — Action Required</p>
      </div>

      <div style="padding: 24px 0;">
        <h3 style="margin: 0 0 12px; font-size: 18px; color: #0f172a;">Dear ${candidateName},</h3>
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px;">
          Our hiring team and the Head of the Department reviewed your submitted document: <strong>${documentTitle}</strong>.
        </p>

        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <h4 style="margin: 0 0 8px; font-size: 14px; color: #991b1b;">Reviewer Feedback / Rejection Reason:</h4>
          <p style="font-size: 14px; line-height: 1.5; color: #b91c1c; margin: 0; font-style: italic;">
            "${rejectionReason}"
          </p>
        </div>

        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px;">
          Please review the feedback above and re-upload a clear, high-resolution, and complete replacement through your candidate portal as soon as possible.
        </p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${portalUrl}" style="background-color: #dc2626; color: #ffffff; font-weight: 600; font-size: 14px; padding: 12px 28px; text-decoration: none; border-radius: 8px; display: inline-block;">
            Re-Upload Document Now &rarr;
          </a>
        </div>
      </div>

      <div style="padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
        <p style="margin: 0;">St. Aloysius Gonzaga Academy, Inc. • Recruitment & Placement Department</p>
      </div>
    </div>
  `;

  return sendEmail({ to, subject, html });
}

export async function sendDocumentVerifiedEmail({
  to,
  candidateName,
  documentTitle,
  organizationName,
  portalUrl,
}: {
  to: string;
  candidateName: string;
  documentTitle: string;
  organizationName: string;
  portalUrl: string;
}) {
  const subject = `Document Verified: ${documentTitle} — ${organizationName}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
      <div style="padding-bottom: 16px; border-bottom: 2px solid #16a34a;">
        <h2 style="margin: 0; color: #1e293b; font-size: 20px;">${organizationName}</h2>
        <p style="margin: 4px 0 0; color: #16a34a; font-weight: 600; font-size: 13px;">Document Status Update: Verified</p>
      </div>

      <div style="padding: 24px 0;">
        <h3 style="margin: 0 0 12px; font-size: 18px; color: #0f172a;">Dear ${candidateName},</h3>
        <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px;">
          Good news! Your submission for <strong>${documentTitle}</strong> has been successfully reviewed and verified by the hiring department.
        </p>

        <div style="text-align: center; margin: 28px 0;">
          <a href="${portalUrl}" style="background-color: #16a34a; color: #ffffff; font-weight: 600; font-size: 14px; padding: 12px 28px; text-decoration: none; border-radius: 8px; display: inline-block;">
            View Your Candidate Portal &rarr;
          </a>
        </div>
      </div>

      <div style="padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
        <p style="margin: 0;">St. Aloysius Gonzaga Academy, Inc. • Recruitment & Placement Department</p>
      </div>
    </div>
  `;

  return sendEmail({ to, subject, html });
}
