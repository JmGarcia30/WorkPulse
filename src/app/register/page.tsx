import Link from 'next/link';
import Image from 'next/image';
import { CompanyRegistrationForm } from '@/features/company-registration/forms';
import { discoveryOrigin } from '@/lib/tenant/host';
import styles from '@/app/request-demo/request-demo.module.css';

const areas = ['Hiring', 'Employee Records', 'Attendance', 'Leave', 'Employee Self-Service'];

export default function CompanyRegistrationPage() {
  return <main className={styles.page}>
    <div className={styles.layout}>
      <section className={styles.intro} aria-labelledby="company-register-title">
        <Link href="/" className={styles.brand} aria-label="Back to WorkPulse">
          <Image src="/branding/workpulse-logo.png?v=trans-2" alt="WorkPulse" width={160} height={28} style={{ height: '28px', width: 'auto', objectFit: 'contain' }} unoptimized priority />
        </Link>
        <div className={styles.introCopy}>
          <p className={styles.eyebrow}>Create workspace</p>
          <h1 id="company-register-title">Your organization. Your workspace.</h1>
          <p className={styles.supportingCopy}>Create a secure WorkPulse workspace for your organization. Verify your work email to activate your first HR administrator account.</p>
          <ul aria-label="WorkPulse capabilities">{areas.map(area => <li key={area}>{area}</li>)}</ul>
        </div>
      </section>
      <section className={styles.formPanel} aria-label="Create an organization workspace">
        <div className={styles.formHeading}><p>Set up your company</p><span>All fields are required.</span></div>
        <CompanyRegistrationForm />
        <p style={{ marginTop: 26, textAlign: 'center', fontSize: 13, color: '#625e5a' }}>Already have a workspace? <a style={{ color: '#7a0000', textDecoration: 'underline' }} href={discoveryOrigin()}>Find your workspace</a></p>
      </section>
    </div>
  </main>;
}
