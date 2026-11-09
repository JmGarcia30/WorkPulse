import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  FileCheck2,
  LockKeyhole,
  Menu,
  ReceiptText,
  UsersRound,
} from 'lucide-react';
import { discoveryOrigin } from '@/lib/tenant/host';
import styles from './landing-clean.module.css';

const journey = [
  {
    number: '01',
    title: 'Hire',
    description: 'Publish openings, review applications, and move successful candidates into employee records.',
  },
  {
    number: '02',
    title: 'Manage',
    description: 'Keep employment details, schedules, and day-to-day employee information organized.',
  },
  {
    number: '03',
    title: 'Track',
    description: 'Record attendance, review time logs, and manage leave requests with clear approvals.',
  },
  {
    number: '04',
    title: 'Pay',
    description: 'Use verified salary and attendance records to prepare payroll and finalized payslips.',
  },
] as const;

const capabilities = [
  {
    Icon: UsersRound,
    title: 'Recruitment and employee records',
    text: 'Move from job postings and applications to employee profiles without maintaining separate records.',
  },
  {
    Icon: Clock3,
    title: 'Attendance and schedules',
    text: 'Track time records, schedules, late arrivals, and undertime in one place.',
  },
  {
    Icon: CalendarDays,
    title: 'Leave management',
    text: 'Let employees submit requests and give HR a clear approval and balance history.',
  },
  {
    Icon: ReceiptText,
    title: 'Payroll and payslips',
    text: 'Review compensation, attendance adjustments, and applicable deductions before finalization.',
  },
] as const;

const basic = [
  'Core HR and employee records',
  'Attendance, leave, payroll, and self-service',
  'Up to 5 simultaneously published jobs',
  'Standard reports and Gmail integration',
] as const;
const pro = [
  'Everything in Basic',
  'Unlimited published job postings',
  'AI-assisted resume parsing',
  'Advanced analytics and report exports',
  'Custom organization branding',
] as const;

function Header({ workspaceUrl }: { workspaceUrl: string }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Link href="/" className={styles.logoLink} aria-label="WorkPulse home">
          <Image src="/branding/workpulse-logo.png?v=trans-2" alt="WorkPulse" width={164} height={35} className={styles.logo} priority unoptimized />
        </Link>
        <nav className={styles.desktopNav} aria-label="Primary navigation">
          <Link href="#platform">Platform</Link>
          <Link href="#features">Features</Link>
          <Link href="#teams">For teams</Link>
          <Link href="#plans">Plans</Link>
        </nav>
        <div className={styles.headerActions}>
          <a href={workspaceUrl} className={styles.signInLink}>Find workspace</a>
          <Link href="/register" className={styles.navCta}>Create workspace <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
        <details className={styles.mobileMenu}>
          <summary aria-label="Open navigation"><Menu size={22} aria-hidden="true" /></summary>
          <nav className={styles.mobileLinks} aria-label="Mobile navigation">
            <Link href="#platform">Platform</Link>
            <Link href="#features">Features</Link>
            <Link href="#teams">For teams</Link>
            <Link href="#plans">Plans</Link>
            <a href={workspaceUrl}>Find workspace / sign in</a>
            <Link href="/register" className={styles.mobileCta}>Create workspace <ArrowRight size={15} aria-hidden="true" /></Link>
          </nav>
        </details>
      </div>
    </header>
  );
}

function Hero({ workspaceUrl }: { workspaceUrl: string }) {
  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      <div className={styles.heroPanel}>
        <div className={styles.heroContent}>
          <p className={styles.heroEyebrow}>WorkPulse / Workforce management</p>
          <h1 id="hero-heading" className={styles.heroTitle}>Every part of work.<br /><span>One clear place.</span></h1>
          <p className={styles.heroDescription}>Bring hiring, employee records, attendance, leave, payroll, and self-service together in a workspace built for your organization.</p>
          <div className={styles.heroActions}>
            <Link href="/register" className={styles.heroPrimary}>Create your workspace <ArrowRight size={17} aria-hidden="true" /></Link>
            <a href={workspaceUrl} className={styles.heroSecondary}>Find your workspace <ArrowRight size={16} aria-hidden="true" /></a>
          </div>
        </div>
        <div className={styles.heroRail} aria-label="WorkPulse capabilities">
          <span>Recruitment</span>
          <span>People</span>
          <span>Attendance &amp; leave</span>
          <span>Payroll</span>
          <span>Self-service</span>
        </div>
      </div>
    </section>
  );
}

function Journey() {
  return (
    <section className={styles.journeySection} id="platform" aria-labelledby="journey-heading">
      <div className={styles.centerIntro}>
        <p className={styles.eyebrow}>The WorkPulse platform</p>
        <h2 id="journey-heading">One record, from the first application to the final payslip.</h2>
        <p>HR tasks are connected because the employee information behind them is connected.</p>
      </div>
      <ol className={styles.journeyGrid}>
        {journey.map((step) => (
          <li className={styles.journeyStep} key={step.title}>
            <span className={styles.stepNumber}>{step.number} / 04</span>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ProductExample() {
  return (
    <div className={styles.preview} aria-label="Illustrative WorkPulse payroll review workflow">
      <div className={styles.previewToolbar}>
        <div className={styles.previewIdentity}>
          <Image src="/branding/workpulse-app-icon.png" alt="" width={24} height={24} />
          <strong>WorkPulse</strong>
          <span>HR workspace</span>
        </div>
        <span className={styles.previewLabel}>Workflow illustration</span>
      </div>
      <div className={styles.previewBody}>
        <aside className={styles.previewSidebar} aria-label="Example workspace modules">
          <span>Overview</span>
          <span>Recruitment</span>
          <span>Employees</span>
          <span>Attendance</span>
          <strong>Payroll</strong>
        </aside>
        <div className={styles.previewMain}>
          <div className={styles.previewTopline}>
            <span>PAYROLL / CUTOFF REVIEW</span>
            <span className={styles.previewDraft}>Review</span>
          </div>
          <h3>From time records to a payslip.</h3>
          <p>Check each step before payroll is finalized.</p>
          <div className={styles.previewWorkflow}>
            <div><span className={styles.previewCheck}><Check size={14} /></span><div><strong>Employee compensation</strong><small>Saved salary and pay frequency</small></div><span>01</span></div>
            <div><span className={styles.previewCheck}><Check size={14} /></span><div><strong>Attendance and leave</strong><small>Verified cutoff records and adjustments</small></div><span>02</span></div>
            <div><span className={styles.previewCheck}><Check size={14} /></span><div><strong>Government contributions</strong><small>Applicable rules and reviewed inputs</small></div><span>03</span></div>
            <div><span className={styles.previewFinal}><FileCheck2 size={15} /></span><div><strong>Finalize and publish</strong><small>Payslip available in employee self-service</small></div><span>04</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Features() {
  return (
    <section className={styles.featuresSection} id="features" aria-labelledby="features-heading">
      <div className={styles.featureLead}>
        <div>
          <p className={styles.eyebrow}>Made for the actual work</p>
          <h2 id="features-heading">Less switching.<br />More clarity.</h2>
        </div>
        <p>Instead of separate tools for each HR task, WorkPulse gives teams a shared place to manage the employee lifecycle.</p>
      </div>
      <div className={styles.featureLayout}>
        <div className={styles.featureList}>
          {capabilities.map(({ Icon, title, text }) => (
            <div className={styles.featureItem} key={title}>
              <Icon size={21} strokeWidth={1.6} aria-hidden="true" />
              <div><h3>{title}</h3><p>{text}</p></div>
            </div>
          ))}
        </div>
        <ProductExample />
      </div>
    </section>
  );
}

function Teams() {
  return (
    <section className={styles.teamsSection} id="teams" aria-labelledby="teams-heading">
      <div className={styles.teamsIntro}>
        <p className={styles.eyebrow}>For everyone in the workflow</p>
        <h2 id="teams-heading">A clearer day for HR.<br />An easier way for employees.</h2>
      </div>
      <div className={styles.teamColumns}>
        <div>
          <span className={styles.teamIndex}>01 / HR &amp; Administrators</span>
          <h3>Keep operations moving.</h3>
          <p>Manage applications, employee records, attendance, leave approvals, and payroll in one workspace.</p>
          <ul>
            <li><Check size={16} /> Central employee records</li>
            <li><Check size={16} /> Review and approval workflows</li>
            <li><Check size={16} /> Reports and payroll preparation</li>
          </ul>
        </div>
        <div>
          <span className={styles.teamIndex}>02 / Employees</span>
          <h3>Find what you need.</h3>
          <p>Check personal attendance, request leave, review employment information, and open finalized payslips.</p>
          <ul>
            <li><Check size={16} /> Attendance and schedules</li>
            <li><Check size={16} /> Leave requests and balances</li>
            <li><Check size={16} /> Finalized payslips</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function WorkspaceSection({ workspaceUrl }: { workspaceUrl: string }) {
  return (
    <section className={styles.workspaceSection} aria-labelledby="workspace-heading">
      <div className={styles.workspaceInner}>
        <div>
          <p className={styles.eyebrowLight}>Organizations, organized</p>
          <h2 id="workspace-heading">Your organization.<br />Your workspace.</h2>
          <p>Each organization has its own workspace, team access, settings, and employee records. WorkPulse keeps those boundaries part of the platform.</p>
          <a href={workspaceUrl} className={styles.workspaceLink}>Find your workspace <ArrowRight size={17} aria-hidden="true" /></a>
        </div>
        <div className={styles.workspaceIllustration} aria-hidden="true">
          <div className={styles.workspaceTop}><LockKeyhole size={19} /><span>Organization workspace</span></div>
          <div className={styles.workspaceRows}>
            <div><span>People &amp; records</span><Check size={16} /></div>
            <div><span>Attendance &amp; leave</span><Check size={16} /></div>
            <div><span>Payroll &amp; self-service</span><Check size={16} /></div>
          </div>
          <p>Access is scoped to your organization.</p>
        </div>
      </div>
    </section>
  );
}

function Plans() {
  return (
    <section className={styles.plansSection} id="plans" aria-labelledby="plans-heading">
      <div className={styles.centerIntro}>
        <p className={styles.eyebrow}>WorkPulse plans</p>
        <h2 id="plans-heading">Start with what your team needs.</h2>
        <p>Core workforce management for every organization. Add advanced tools as your needs grow.</p>
      </div>
      <div className={styles.planGrid}>
        <article className={styles.planCard}>
          <div className={styles.planTop}><span>01 / BASIC</span><h3>Basic</h3><p>For teams getting their HR operations in one place.</p></div>
          <ul>{basic.map(item => <li key={item}><Check size={16} aria-hidden="true" />{item}</li>)}</ul>
          <Link href="/register" className={styles.planLink}>Create workspace <ArrowRight size={16} aria-hidden="true" /></Link>
        </article>
        <article className={styles.planCard}>
          <div className={styles.planTop}><span>02 / PRO</span><h3>Pro</h3><p>For organizations that need more flexibility and insight.</p></div>
          <ul>{pro.map(item => <li key={item}><Check size={16} aria-hidden="true" />{item}</li>)}</ul>
          <Link href="/request-demo" className={styles.planLink}>Ask about Pro <ArrowRight size={16} aria-hidden="true" /></Link>
        </article>
      </div>
      <p className={styles.planFootnote}>Plan prices and online checkout are not published here. Contact the team for current availability and terms.</p>
    </section>
  );
}

function Closing() {
  return (
    <section className={styles.closingSection}>
      <div className={styles.closingInner}>
        <p className={styles.eyebrow}>Get started</p>
        <h2>Work better, from one place.</h2>
        <p>Bring your workforce operations together in WorkPulse.</p>
        <div className={styles.closingActions}>
          <Link href="/register" className={styles.closingPrimary}>Create your workspace <ArrowRight size={17} aria-hidden="true" /></Link>
          <Link href="/request-demo" className={styles.closingSecondary}>Request a demo <ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
      </div>
    </section>
  );
}

function Footer({ workspaceUrl }: { workspaceUrl: string }) {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerBrand}>
          <Link href="/" aria-label="WorkPulse home"><Image src="/branding/workpulse-logo.png?v=trans-2" alt="WorkPulse" width={170} height={36} unoptimized /></Link>
          <p>Connected workforce operations, from hiring to employee self-service.</p>
        </div>
        <nav aria-label="Footer navigation" className={styles.footerLinks}>
          <div><strong>Explore</strong><Link href="#platform">Platform</Link><Link href="#features">Features</Link><Link href="#plans">Plans</Link></div>
          <div><strong>Get started</strong><Link href="/register">Create workspace</Link><Link href="/request-demo">Request demo</Link><a href={workspaceUrl}>Find workspace</a></div>
          <div><strong>Information</strong><Link href="/security">Security</Link><Link href="/features">All features</Link></div>
        </nav>
      </div>
      <div className={styles.footerBottom}><span>© {new Date().getFullYear()} WorkPulse</span><span>Built for connected workforce operations.</span></div>
    </footer>
  );
}

export default function HomePage() {
  const workspaceUrl = discoveryOrigin();
  return (
    <div className={styles.page}>
      <a href="#main-content" className={styles.skipLink}>Skip to content</a>
      <Header workspaceUrl={workspaceUrl} />
      <main id="main-content">
        <Hero workspaceUrl={workspaceUrl} />
        <Journey />
        <Features />
        <Teams />
        <WorkspaceSection workspaceUrl={workspaceUrl} />
        <Plans />
        <Closing />
      </main>
      <Footer workspaceUrl={workspaceUrl} />
    </div>
  );
}
