import { PlatformLoginForm } from '@/features/platform-admin/forms';
import Image from 'next/image';
import { ShieldCheck } from 'lucide-react';
import styles from './page.module.css';

export default function PlatformLoginPage() {
  return <main className={styles.page}>
    <div className={styles.brand}><Image src="/branding/workpulse-logo-transparent.png" alt="WorkPulse" width={180} height={60} priority className={styles.logo} /></div>
    <section className={styles.card} aria-labelledby="platform-login-title">
      <span className={styles.emblem}><ShieldCheck size={24} aria-hidden="true" /></span>
      <p className={styles.eyebrow}>Platform Administration</p>
      <h1 id="platform-login-title">Welcome back.</h1>
      <p className={styles.intro}>Sign in to manage the WorkPulse platform.</p>
      <PlatformLoginForm />
      <p className={styles.notice}><ShieldCheck size={15} aria-hidden="true" />Authorized platform administrators only</p>
    </section>
    <p className={styles.footer}>WorkPulse <span aria-hidden="true">/</span> People. Work. Connected.</p>
  </main>;
}
