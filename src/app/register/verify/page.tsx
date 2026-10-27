import Link from 'next/link';
import Image from 'next/image';
import { CompanyVerificationForm } from '@/features/company-registration/forms';
import styles from '@/app/request-demo/request-demo.module.css';

export default function CompanyVerificationPage() {
  return <main className={styles.page}>
    <div className={styles.layout}>
      <section className={styles.intro} aria-labelledby="verify-title">
        <Link href="/" className={styles.brand} aria-label="Back to WorkPulse">
          <Image src="/branding/workpulse-logo.png?v=trans-2" alt="WorkPulse" width={160} height={28} style={{ height: '28px', width: 'auto', objectFit: 'contain' }} unoptimized priority />
        </Link>
        <div className={styles.introCopy}>
          <p className={styles.eyebrow}>Secure onboarding</p>
          <h1 id="verify-title">Verify your email. Activate your workspace.</h1>
          <p className={styles.supportingCopy}>Verify the email you used to register before your company workspace and first HR administrator account are created.</p>
        </div>
      </section>
      <section className={styles.formPanel} aria-label="Verify company email">
        <div className={styles.formHeading}><p>Email verification</p><span>Six-digit verification code</span></div>
        <div style={{ marginTop: 28 }}><CompanyVerificationForm /></div>
      </section>
    </div>
  </main>;
}
