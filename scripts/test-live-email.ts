import dotenv from 'dotenv';
dotenv.config();

import { sendEmail } from '../src/lib/email';

async function main() {
  console.log('Testing Gmail SMTP dispatch with user:', process.env.GMAIL_USER);
  const result = await sendEmail({
    to: 'jmgarcia3005@gmail.com',
    subject: 'WorkPulse Live Email Verification',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b;">
        <h2 style="color: #4f46e5;">WorkPulse Email System Operational</h2>
        <p>Hello HR Administrator,</p>
        <p>This is a test notification confirming that your free Gmail SMTP transport and Google App Password are fully verified and working.</p>
        <p>Applicants and new hires will now receive official notifications directly in their inboxes.</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <small style="color: #64748b;">Sent securely via WorkPulse Automated Email Service</small>
      </div>
    `,
  });

  console.log('Result:', result);
  if (result.mode === 'smtp' && result.success) {
    console.log('SUCCESS: Live email sent via SMTP successfully!');
  } else {
    console.log('NOTE: Email dispatched in mode:', result.mode);
  }
}

main().catch((err) => {
  console.error('Error sending test email:', err);
  process.exit(1);
});
