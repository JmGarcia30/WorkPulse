import Link from 'next/link';
import { requestDemoAction } from './actions';
import styles from './request-demo.module.css';

const workPulseAreas = ['Hiring', 'Employee Records', 'Attendance', 'Leave', 'Employee Self-Service'];

export default async function RequestDemoPage({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string; fields?: string }> }) {
  const state = await searchParams;
  const sent = state.sent === '1';
  const invalid = state.error === 'invalid';
  const deliveryError = state.error === 'delivery';
  const invalidFields = new Set((state.fields || '').split(',').filter(Boolean));

  if (sent) {
    return <main className={styles.page}><section className={styles.confirmation} aria-labelledby="confirmation-title"><Link href="/" className={styles.brand} aria-label="Back to WorkPulse"><span>W</span>WorkPulse</Link><p className={styles.eyebrow}>Request demo</p><h1 id="confirmation-title">Demo request received.</h1><p>Thanks for reaching out. Your request has been sent to the WorkPulse team.</p><Link href="/" className={styles.backButton}>Back to WorkPulse</Link></section></main>;
  }

  return <main className={styles.page}><div className={styles.layout}><section className={styles.intro} aria-labelledby="request-demo-title"><Link href="/" className={styles.brand} aria-label="Back to WorkPulse"><span>W</span>WorkPulse</Link><div className={styles.introCopy}><p className={styles.eyebrow}>Request demo</p><h1 id="request-demo-title">See how WorkPulse fits your organization.</h1><p className={styles.supportingCopy}>Tell us about your workforce process and the areas you want to improve. We&apos;ll use your request to understand what your organization needs.</p><ul aria-label="WorkPulse areas">{workPulseAreas.map((area) => <li key={area}>{area}</li>)}</ul></div></section><section className={styles.formPanel} aria-label="Request a WorkPulse demo"><div className={styles.formHeading}><p>Tell us what you need</p><span>All fields are required.</span></div>{invalid && <p role="alert" className={styles.errorMessage}>Please check the highlighted fields.</p>}{deliveryError && <p role="alert" className={styles.errorMessage}>We couldn&apos;t send your request right now. Please try again.</p>}<form action={requestDemoAction} className={styles.form}><input className={styles.honeypot} tabIndex={-1} autoComplete="off" name="website" aria-hidden="true" /><label>Name<input required minLength={2} maxLength={100} name="name" autoComplete="name" aria-invalid={invalidFields.has('name')} /></label><label>Work email<input required type="email" maxLength={254} name="email" autoComplete="email" aria-invalid={invalidFields.has('email')} /></label><label>Organization<input required minLength={2} maxLength={160} name="organization" autoComplete="organization" aria-invalid={invalidFields.has('organization')} /></label><label>What would you like to improve?<textarea required minLength={10} maxLength={2000} name="message" placeholder="Hiring, employee records, attendance, leave, employee self-service..." aria-invalid={invalidFields.has('message')} /></label><button type="submit">Request Demo</button></form></section></div></main>;
}
