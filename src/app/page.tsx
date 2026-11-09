import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarCheck2,
  Check,
  Clock3,
  FileCheck2,
  FolderOpen,
  Layers3,
  LockKeyhole,
  Menu,
  ReceiptText,
  ShieldCheck,
  UsersRound,
  Zap,
} from 'lucide-react';
import { discoveryOrigin } from '@/lib/tenant/host';
import styles from './landing-clean.module.css';

const lifecycle = [
  { title: 'Hire', text: 'Recruit and onboard employees.', Icon: BriefcaseBusiness },
  { title: 'Manage', text: 'Keep employee records up to date.', Icon: FolderOpen },
  { title: 'Track', text: 'Handle attendance, leave, and schedules.', Icon: CalendarCheck2 },
  { title: 'Pay', text: 'Prepare and review payroll cutoffs.', Icon: ReceiptText },
  { title: 'Support', text: 'Give employees self-service access.', Icon: UsersRound },
] as const;

const advantages = [
  {
    title: 'All-in-one, not add-on',
    text: 'Core HR, time, leave, and payroll in a single connected platform.',
    Icon: Layers3,
  },
  {
    title: 'Organization-scoped',
    text: 'Workspace access and employee data are separated by organization.',
    Icon: ShieldCheck,
  },
  {
    title: 'Practical for every team',
    text: 'Clear workflows for HR, with self-service tools for employees.',
    Icon: Zap,
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
        <Link href="/" className={styles.brand} aria-label="WorkPulse home">
          <Image src="/branding/workpulse-logo.png?v=trans-2" alt="WorkPulse" width={163} height={34} className={styles.brandLogo} unoptimized priority />
        </Link>
        <nav className={styles.desktopNav} aria-label="Primary navigation">
          <Link href="#features">Features</Link>
          <Link href="#lifecycle">Lifecycle</Link>
          <Link href="#modules">Modules</Link>
          <Link href="#security">Security</Link>
          <Link href="#plans">Plans</Link>
        </nav>
        <div className={styles.headerActions}>
          <a href={workspaceUrl} className={styles.signInLink}>Find Workspace / Sign In</a>
          <Link href="/register" className={styles.navButton}>Create Workspace <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
        <details className={styles.mobileMenu}>
          <summary aria-label="Open navigation menu"><Menu size={22} aria-hidden="true" /></summary>
          <nav className={styles.mobileLinks} aria-label="Mobile navigation">
            <Link href="#features">Features</Link>
            <Link href="#lifecycle">Lifecycle</Link>
            <Link href="#modules">Modules</Link>
            <Link href="#security">Security</Link>
            <Link href="#plans">Plans</Link>
            <a href={workspaceUrl}>Find Workspace / Sign In</a>
            <Link href="/register" className={styles.mobileCta}>Create Workspace <ArrowRight size={15} aria-hidden="true" /></Link>
          </nav>
        </details>
      </div>
    </header>
  );
}

function Hero({ workspaceUrl }: { workspaceUrl: string }) {
  return (
    <section className={styles.hero} aria-labelledby="hero-heading" id="hero">
      <div className={styles.heroContent}>
        <p className={styles.heroEyebrow}>
          <Image src="/branding/workpulse-mark.png" alt="" width={24} height={19} unoptimized aria-hidden="true" />
          WorkPulse Workforce Management
        </p>
        <h1 id="hero-heading" className={styles.heroTitle}>
          Manage your workforce<br />
          <span>all in one place.</span>
        </h1>
        <p className={styles.heroSubtitle}>
          From hiring and employee records to attendance, leave, and self-service,
          WorkPulse keeps workforce operations connected.
        </p>
        <div className={styles.heroActions}>
          <Link href="/register" className={styles.primaryButton}>Create your workspace <ArrowRight size={16} aria-hidden="true" /></Link>
          <a href={workspaceUrl} className={styles.heroTextLink}>Find your workspace <ArrowRight size={15} aria-hidden="true" /></a>
        </div>
      </div>
    </section>
  );
}

function Lifecycle() {
  return (
    <section className={styles.section} id="lifecycle" aria-labelledby="lifecycle-heading">
      <div className={styles.sectionHeadingCenter}>
        <p className={styles.eyebrow}>The employee lifecycle on WorkPulse</p>
        <h2 id="lifecycle-heading">A complete workforce platform for HR teams.</h2>
        <p>Support every stage of the employee journey with connected, easy-to-use tools.</p>
      </div>
      <ol className={styles.lifecycleGrid}>
        {lifecycle.map(({ title, text, Icon }, index) => (
          <li className={styles.lifecycleStep} key={title}>
            <span className={styles.lifecycleIcon}><Icon size={26} strokeWidth={1.7} aria-hidden="true" /></span>
            <h3>{title}</h3>
            <p>{text}</p>
            {index < lifecycle.length - 1 && <ArrowRight className={styles.lifecycleArrow} size={18} strokeWidth={1.6} aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </section>
  );
}

function HRDashboardPreview() {
  return (
    <div className={styles.dashboard} role="img" aria-label="Illustration of a WorkPulse HR workspace with employees, attendance, leave, and payroll in one dashboard">
      <div className={styles.dashboardTop}>
        <div className={styles.dashboardLogo}>
          <Image src="/branding/workpulse-mark.png" alt="" width={27} height={20} unoptimized />
          <strong>WorkPulse</strong>
        </div>
        <span>Illustrative workspace view</span>
      </div>
      <div className={styles.dashboardBody}>
        <div className={styles.dashboardSidebar} aria-hidden="true">
          <strong>Overview</strong>
          <span><UsersRound size={14} /> Employees</span>
          <span><Clock3 size={14} /> Attendance</span>
          <span><CalendarCheck2 size={14} /> Leave</span>
          <span><ReceiptText size={14} /> Payroll</span>
          <span><FolderOpen size={14} /> Reports</span>
        </div>
        <div className={styles.dashboardMain}>
          <div className={styles.dashboardIntro}>
            <div><span>HR WORKSPACE</span><h3>HR Overview</h3></div>
            <span className={styles.dashboardPeriod}>Overview</span>
          </div>
          <div className={styles.dashboardTiles}>
            <div><UsersRound size={18}/><strong>Employees</strong><small>People &amp; records</small></div>
            <div><Clock3 size={18}/><strong>Attendance</strong><small>Daily time logs</small></div>
            <div><CalendarCheck2 size={18}/><strong>Leave</strong><small>Requests &amp; balance</small></div>
            <div><ReceiptText size={18}/><strong>Payroll</strong><small>Cutoff review</small></div>
          </div>
          <div className={styles.dashboardProgress}>
            <div><strong>Connected workflow</strong><span>From records to payroll</span></div>
            <div className={styles.dashboardFlow}>
              <span><Check size={12} /> Employee records</span>
              <ArrowRight size={13} aria-hidden="true" />
              <span><Check size={12} /> Time &amp; leave</span>
              <ArrowRight size={13} aria-hidden="true" />
              <span><FileCheck2 size={12} /> Payslips</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HRSection() {
  return (
    <section className={styles.section} id="modules" aria-labelledby="hr-heading">
      <div className={styles.hrLayout}>
        <div className={styles.hrCopy}>
          <p className={styles.eyebrow}>Built for HR</p>
          <h2 id="hr-heading">Give HR the control, visibility, and time to focus on people.</h2>
          <p>WorkPulse brings your people, processes, and workforce data together, so HR can work across recruitment, attendance, leave, payroll, and employee records.</p>
          <Link href="/features" className={styles.textCta}>Explore HR features <ArrowRight size={17} aria-hidden="true" /></Link>
        </div>
        <HRDashboardPreview />
      </div>
    </section>
  );
}

function Advantages() {
  return (
    <section className={styles.section} id="features" aria-labelledby="features-heading">
      <div className={styles.sectionHeadingCenter}>
        <p className={styles.eyebrow}>Why HR teams choose WorkPulse</p>
        <h2 id="features-heading">A modern HR platform that makes work simpler.</h2>
      </div>
      <div className={styles.advantageGrid}>
        {advantages.map(({ Icon, title, text }) => (
          <div className={styles.advantage} key={title}>
            <Icon size={29} strokeWidth={1.6} aria-hidden="true" />
            <div><h3>{title}</h3><p>{text}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Plans() {
  return (
    <section className={styles.section} id="plans" aria-labelledby="plans-heading">
      <div className={styles.sectionHeadingCenter}>
        <p className={styles.eyebrow}>WorkPulse subscriptions</p>
        <h2 id="plans-heading">Plans for growing teams.</h2>
        <p>Choose the plan that fits your organization. Pricing and subscription terms are provided on request.</p>
      </div>
      <div className={styles.planGrid}>
        <article className={styles.planCard}>
          <div className={styles.planHeader}>
            <span className={styles.planIcon}><Layers3 size={25} strokeWidth={1.8} /></span>
            <div><h3>Basic</h3><p>Essential HR tools to organize your team.</p></div>
          </div>
          <div className={styles.planPrice}>Price available upon request</div>
          <ul>{basic.map(item => <li key={item}><Check size={16} aria-hidden="true" /><span>{item}</span></li>)}</ul>
          <Link href="/request-demo" className={styles.planOutlineButton}>Contact for pricing <ArrowRight size={16} aria-hidden="true" /></Link>
        </article>
        <article className={styles.planCardPro}>
          <div className={styles.planHeader}>
            <span className={styles.planIcon}><Zap size={25} strokeWidth={1.8} /></span>
            <div><h3>Pro</h3><p>Advanced capabilities for growing organizations.</p></div>
          </div>
          <div className={styles.planPricePro}>Contact for pricing</div>
          <ul>{pro.map(item => <li key={item}><Check size={16} aria-hidden="true" /><span>{item}</span></li>)}</ul>
          <Link href="/request-demo" className={styles.planFilledButton}>Contact for pricing <ArrowRight size={16} aria-hidden="true" /></Link>
        </article>
      </div>
    </section>
  );
}

function Security() {
  return (
    <section className={styles.securityStrip} id="security" aria-labelledby="security-heading">
      <LockKeyhole size={21} aria-hidden="true" />
      <div>
        <h2 id="security-heading">Separate workspaces. Scoped access.</h2>
        <p>Employee records stay within their organization&apos;s workspace, with role-based permissions for HR and staff.</p>
      </div>
      <Link href="/security">About security <ArrowRight size={16} aria-hidden="true" /></Link>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className={styles.finalCta} aria-labelledby="final-cta-heading">
      <h2 id="final-cta-heading">Ready to simplify your HR operations?</h2>
      <p>Create your WorkPulse workspace and bring your workforce together today.</p>
      <Link href="/register" className={styles.primaryButton}>Create your workspace <ArrowRight size={16} aria-hidden="true" /></Link>
    </section>
  );
}

function Footer({ workspaceUrl }: { workspaceUrl: string }) {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerIdentity}>
          <Link href="/" aria-label="WorkPulse home"><Image src="/branding/workpulse-logo.png?v=trans-2" alt="WorkPulse" width={163} height={34} unoptimized /></Link>
          <p>Workforce management for modern HR teams.</p>
        </div>
        <nav aria-label="Footer navigation" className={styles.footerColumns}>
          <div><strong>Product</strong><Link href="#features">Features</Link><Link href="#modules">Modules</Link><Link href="#lifecycle">Lifecycle</Link><Link href="#plans">Plans</Link></div>
          <div><strong>Access</strong><Link href="/register">Create workspace</Link><a href={workspaceUrl}>Find workspace</a><Link href="/request-demo">Request demo</Link></div>
          <div><strong>Information</strong><Link href="/security">Security</Link><Link href="/features">All features</Link></div>
        </nav>
      </div>
      <div className={styles.footerBottom}><span>© {new Date().getFullYear()} WorkPulse</span><span>Workforce operations, connected.</span></div>
    </footer>
  );
}

export default function HomePage() {
  const workspaceUrl = discoveryOrigin();
  return (
    <div className={styles.page}>
      <a href="#main-content" className={styles.skipLink}>Skip to main content</a>
      <Header workspaceUrl={workspaceUrl} />
      <main id="main-content">
        <Hero workspaceUrl={workspaceUrl} />
        <Lifecycle />
        <HRSection />
        <Advantages />
        <Plans />
        <Security />
        <FinalCTA />
      </main>
      <Footer workspaceUrl={workspaceUrl} />
    </div>
  );
}
