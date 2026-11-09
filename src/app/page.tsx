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
  ReceiptText,
  ShieldCheck,
  UsersRound,
  Zap,
} from 'lucide-react';
import { discoveryOrigin } from '@/lib/tenant/host';
import { LandingNavbar } from './landing-navbar';
import { ProductModulesShowcase } from './product-modules-showcase';
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
          <div className={styles.heroButtonRow}>
            <Link href="/register" className={styles.primaryButton}>Create your workspace <ArrowRight size={16} aria-hidden="true" /></Link>
            <Link href="#lifecycle" className={styles.heroOutlineButton}>See how it works <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
          <a href={workspaceUrl} className={styles.heroTextLink}>Find your workspace <ArrowRight size={15} aria-hidden="true" /></a>
        </div>
      </div>
      <svg className={styles.heroWaves} viewBox="0 0 1440 170" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path fill="#e9cdd0" d="M0 114 C145 70 265 116 385 151 C505 180 624 144 755 112 C883 81 991 108 1100 66 C1226 18 1325 5 1440 0 L1440 170 L0 170Z" />
        <path fill="#d9adb4" d="M0 149 C152 128 260 142 380 170 L715 170 C892 145 1005 130 1124 93 C1252 53 1362 60 1440 37 L1440 170 L0 170Z" />
        <path fill="#8c2035" d="M835 170 C984 155 1090 132 1200 91 C1308 51 1374 39 1440 37 L1440 170Z" />
        <path fill="#690c22" d="M1071 170 C1203 151 1303 98 1440 81 L1440 170Z" />
      </svg>
    </section>
  );
}

function Lifecycle() {
  return (
    <section className={`${styles.section} ${styles.sectionWhite}`} id="lifecycle" aria-labelledby="lifecycle-heading">
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
        <span>Illustrative data</span>
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
            <div><UsersRound size={18}/><strong>324</strong><small>Employees</small></div>
            <div><Clock3 size={18}/><strong>98%</strong><small>Attendance</small></div>
            <div><CalendarCheck2 size={18}/><strong>12</strong><small>On leave</small></div>
            <div><BriefcaseBusiness size={18}/><strong>6</strong><small>Open roles</small></div>
          </div>
          <div className={styles.dashboardProgress}>
            <div><strong>Workforce trend</strong><span>Sample dashboard data</span></div>
            <svg className={styles.dashboardChart} viewBox="0 0 480 104" preserveAspectRatio="none" aria-hidden="true">
              <defs><linearGradient id="landing-chart-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#7a0000" stopOpacity="0.16" /><stop offset="1" stopColor="#7a0000" stopOpacity="0" /></linearGradient></defs>
              <path d="M0 85 C30 75 52 53 80 62 S126 81 164 61 S215 69 245 48 S292 62 325 43 S377 58 414 26 S460 32 480 14 V104 H0Z" fill="url(#landing-chart-fill)" />
              <path d="M0 85 C30 75 52 53 80 62 S126 81 164 61 S215 69 245 48 S292 62 325 43 S377 58 414 26 S460 32 480 14" fill="none" stroke="#7a0000" strokeWidth="2.4" strokeLinecap="round" />
              <circle cx="480" cy="14" r="4.5" fill="#7a0000" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function HRSection() {
  return (
    <section className={`${styles.section} ${styles.sectionTint}`} id="hr" aria-labelledby="hr-heading">
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

function Modules() {
  return (
    <section className={`${styles.section} ${styles.modulesSection} ${styles.sectionWhite}`} id="modules" aria-labelledby="modules-heading">
      <div className={styles.sectionHeadingCenter}>
        <p className={styles.eyebrow}>Explore the platform</p>
        <h2 id="modules-heading">The tools behind every HR workflow.</h2>
        <p>Select a module to see what WorkPulse supports. These previews use illustrative records.</p>
      </div>
      <ProductModulesShowcase />
    </section>
  );
}

function Advantages() {
  return (
    <section className={`${styles.section} ${styles.sectionWhite}`} id="features" aria-labelledby="features-heading">
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
    <section className={`${styles.section} ${styles.sectionTint}`} id="plans" aria-labelledby="plans-heading">
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
      <LandingNavbar workspaceUrl={workspaceUrl} />
      <main id="main-content">
        <Hero workspaceUrl={workspaceUrl} />
        <Lifecycle />
        <HRSection />
        <Advantages />
        <Modules />
        <Plans />
        <Security />
        <FinalCTA />
      </main>
      <Footer workspaceUrl={workspaceUrl} />
    </div>
  );
}
