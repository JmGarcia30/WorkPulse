import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarCheck2,
  Check,
  Clock3,
  Globe,
  History,
  KeyRound,
  Layers,
  Lock,
  Server,
  ShieldCheck,
  UserCheck,
  UsersRound,
} from 'lucide-react';
import { discoveryOrigin } from '@/lib/tenant/host';
import { LandingNavbar } from './landing-navbar';
import { ProductModulesShowcase } from './product-modules-showcase';
import styles from './landing.module.css';

const lifecycleStages = [
  {
    number: '01',
    title: 'Hiring',
    subtitle: 'Recruitment & Intake',
    description: 'Recruit applicants, structure qualifications, and move successful candidates directly into personnel files without manual re-entry.',
    transitionNote: 'Candidate to Employee File',
  },
  {
    number: '02',
    title: 'Employment',
    subtitle: 'Workforce Master File',
    description: 'Establish permanent employment records, manage probation milestones, department assignments, and track job status changes.',
    transitionNote: 'Probation to Regular Status',
  },
  {
    number: '03',
    title: 'Attendance & Leave',
    subtitle: 'Time & Absence Sync',
    description: 'Capture daily time records, enforce schedule policies, and synchronize approved leave requests directly into unified attendance.',
    transitionNote: 'Time Logs to Timesheets',
  },
  {
    number: '04',
    title: 'Payroll',
    subtitle: 'Compensation Basis',
    description: 'Translate validated attendance records, base compensation, and pay frequencies into reliable payroll cutoffs.',
    transitionNote: 'Timesheets to Payroll Cutoff',
  },
  {
    number: '05',
    title: 'Employee Services',
    subtitle: 'Self-Service Portal',
    description: 'Empower personnel with controlled self-service access to schedules, leave balances, and verified personal profile data.',
    transitionNote: 'Direct Employee Self-Service',
  },
  {
    number: '06',
    title: 'Exit',
    subtitle: 'Separation & Archival',
    description: 'Support structured offboarding, final status updates, and permanent archival with complete organizational audit trails.',
    transitionNote: 'Archival & Record Preservation',
  },
] as const;

function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link href="/" className={styles.brand} aria-label="WorkPulse home">
      <Image
        src={inverse ? '/branding/workpulse-logo-white.png?v=trans-2' : '/branding/workpulse-logo.png?v=trans-2'}
        alt="WorkPulse"
        width={160}
        height={28}
        className={styles.brandLogoImg}
        unoptimized
      />
    </Link>
  );
}

function ProductPreview() {
  return (
    <div className={styles.productFragments} aria-label="WorkPulse product interface previews">
      <article className={`${styles.productFragment} ${styles.employeeFragment}`}>
        <div className={styles.fragmentHeader}>
          <span><UsersRound size={15} /> Employee record</span>
          <span className={styles.statusChip}>Active</span>
        </div>
        <div className={styles.fragmentPerson}>
          <span>EV</span>
          <div>
            <strong>Elena Vance</strong>
            <small>Information Technology</small>
          </div>
        </div>
        <div className={styles.fragmentRow}>
          <span>Employment status</span>
          <strong>Regular</strong>
        </div>
      </article>

      <article className={`${styles.productFragment} ${styles.attendanceFragment}`}>
        <div className={styles.fragmentHeader}>
          <span><Clock3 size={15} /> Attendance</span>
          <small>Today</small>
        </div>
        <div className={styles.attendanceState}>
          <span><Check size={17} /></span>
          <div>
            <strong>On Time</strong>
            <small>08:02 AM</small>
          </div>
        </div>
        <div className={styles.scheduleLine}>
          <CalendarCheck2 size={14} />
          <span>Weekday schedule</span>
        </div>
      </article>

      <article className={`${styles.productFragment} ${styles.hiringFragment}`}>
        <div className={styles.fragmentHeader}>
          <span><BriefcaseBusiness size={15} /> Candidate review</span>
          <small>Hiring</small>
        </div>
        <div className={styles.hiringProgress}>
          <div>
            <Check size={13} />
            <span>Resume parsed</span>
          </div>
          <div>
            <UserCheck size={13} />
            <strong>HR review required</strong>
          </div>
        </div>
      </article>

      <article className={`${styles.productFragment} ${styles.leaveFragment}`}>
        <div className={styles.fragmentHeader}>
          <span><CalendarCheck2 size={15} /> Leave request</span>
          <span className={styles.statusChip}>Approved</span>
        </div>
        <div className={styles.fragmentRow}>
          <span>Employee self-service</span>
          <strong>Request reviewed</strong>
        </div>
      </article>
    </div>
  );
}

function Hero({ workspaceUrl }: { workspaceUrl: string }) {
  return (
    <section id="hero" className={styles.hero}>
      <ProductPreview />
      <div className={styles.heroHeader}>
        <div className={styles.heroMark}>
          <Image
            src="/branding/workpulse-app-icon.png"
            alt="WorkPulse"
            width={24}
            height={24}
            className={styles.heroMarkIcon}
          />
          <span>WorkPulse workforce management</span>
        </div>
        <h1 className={styles.heroTitle}>
          <span className={styles.heroLinePrimary}>Manage your workforce</span>
          <span className={styles.heroLineSecondary}>all in one place.</span>
        </h1>
        <p className={styles.heroSubtitle}>
          From hiring and employee records to attendance, leave, and self-service, WorkPulse keeps workforce operations connected.
        </p>
        <div className={styles.heroActions}>
          <Link href="/request-demo" className={styles.primaryCtaBtn}>
            Request a demo <ArrowRight size={15} />
          </Link>
          <a href={workspaceUrl} className={styles.secondaryCtaBtn}>
            Find your workspace <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </section>
  );
}

function SectionLabel({ children, inverse = false }: { children: React.ReactNode; inverse?: boolean }) {
  return <p className={`${styles.sectionLabel} ${inverse ? styles.sectionLabelInverse : ''}`}>{children}</p>;
}

function RecordsSection() {
  return (
    <section id="features" className={`${styles.section} ${styles.recordsSection}`}>
      <div className={styles.recordsFeatureLayout}>
        <div className={styles.recordsFeatureCopy}>
          <SectionLabel>Employee records</SectionLabel>
          <h2 className={styles.sectionHeading}>
            Keep every<br />employee record<br />
            <span className={styles.serifAccent}>connected.</span>
          </h2>
          <p className={styles.sectionParagraph}>
            WorkPulse keeps employment details, attendance, leave, and employee access connected in one record.
          </p>
        </div>
        <div
          className={styles.recordSystem}
          aria-label="Employment history, attendance, leave, and employee self-service connected to one employee record"
        >
          <div className={styles.recordOrbit} aria-hidden="true" />
          <div className={`${styles.recordModule} ${styles.recordModuleHistory}`}>
            <span><History size={16} strokeWidth={1.7} /></span>
            <div>
              <small>Employment</small>
              <strong>History</strong>
            </div>
          </div>
          <div className={`${styles.recordModule} ${styles.recordModuleAttendance}`}>
            <span><Clock3 size={16} strokeWidth={1.7} /></span>
            <div>
              <small>Attendance</small>
              <strong>On Time</strong>
            </div>
          </div>
          <div className={`${styles.recordModule} ${styles.recordModuleLeave}`}>
            <span><CalendarCheck2 size={16} strokeWidth={1.7} /></span>
            <div>
              <small>Leave</small>
              <strong>Approved</strong>
            </div>
          </div>
          <div className={`${styles.recordModule} ${styles.recordModuleEss}`}>
            <span><UserCheck size={16} strokeWidth={1.7} /></span>
            <div>
              <small>Self-service</small>
              <strong>Active</strong>
            </div>
          </div>
          <article className={styles.recordCore}>
            <div className={styles.recordCoreHeader}>
              <span><UsersRound size={16} strokeWidth={1.7} /></span>
              <strong>Employee Record</strong>
            </div>
            <div className={styles.recordCorePerson}>
              <div className={styles.recordCoreAvatar}>EV</div>
              <div>
                <small>Employee</small>
                <h3>Elena Vance</h3>
                <p>Information Technology</p>
              </div>
            </div>
            <div className={styles.recordCoreDetails}>
              <div>
                <span>Employment</span>
                <strong>Regular</strong>
              </div>
              <div>
                <span>Schedule</span>
                <strong>Weekday Schedule</strong>
              </div>
            </div>
            <div className={styles.recordCoreStatus}>
              <span aria-hidden="true" />
              <p>Records connected</p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function LifecycleSection() {
  return (
    <section id="lifecycle" className={`${styles.section} ${styles.lifecycleSection}`}>
      <div className={styles.lifecycleLayout}>
        <div className={styles.lifecycleStickyIntro}>
          <SectionLabel>Employee lifecycle</SectionLabel>
          <h2 className={styles.sectionHeading}>
            One employee.<br />
            <span className={styles.serifAccent}>One connected journey.</span>
          </h2>
          <p className={styles.sectionParagraph}>
            WorkPulse keeps workforce information connected from recruitment through employment and separation.
          </p>
          <div className={styles.lifecycleMetaBox}>
            <div className={styles.lifecycleMetaRow}>
              <span className={styles.lifecycleMetaDot} />
              <span>Unified workforce record across all stages</span>
            </div>
            <div className={styles.lifecycleMetaRow}>
              <span className={styles.lifecycleMetaDot} />
              <span>Zero duplicate data entry or lost history</span>
            </div>
            <div className={styles.lifecycleMetaRow}>
              <span className={styles.lifecycleMetaDot} />
              <span>Organization-scoped audit accountability</span>
            </div>
          </div>
        </div>

        <div className={styles.lifecycleTimelineCol}>
          <ol className={styles.lifecycleVerticalTrack} aria-label="Employee lifecycle stages">
            {lifecycleStages.map((stage) => (
              <li className={styles.lifecycleVerticalStep} key={stage.title}>
                <div className={styles.lifecycleVerticalNode}>
                  <span className={styles.lifecycleNodeNumber}>{stage.number}</span>
                  <span className={styles.lifecycleNodePin} aria-hidden="true" />
                </div>
                <div className={styles.lifecycleVerticalBody}>
                  <div className={styles.lifecycleStepHeader}>
                    <span className={styles.lifecycleStepSubtitle}>{stage.subtitle}</span>
                    <h3 className={styles.lifecycleStepTitle}>{stage.title}</h3>
                  </div>
                  <p className={styles.lifecycleStepDescription}>{stage.description}</p>
                  <div className={styles.lifecycleTransitionBadge}>
                    <ArrowRight size={13} className={styles.iconMaroon} />
                    <span>{stage.transitionNote}</span>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function ModulesSection() {
  return (
    <section id="modules" className={`${styles.section} ${styles.modulesSection}`}>
      <div className={styles.sectionIntro}>
        <SectionLabel>Product capabilities</SectionLabel>
        <h2 className={styles.sectionHeading}>
          Everything HR needs,<br />
          <span className={styles.serifAccent}>without disconnected systems.</span>
        </h2>
        <p className={styles.sectionParagraph}>
          WorkPulse eliminates disconnected spreadsheets and fragmented software. Every module shares the same underlying workforce data layer.
        </p>
      </div>

      <ProductModulesShowcase />
    </section>
  );
}

function WorkspacesSection() {
  return (
    <section id="workspaces" className={`${styles.section} ${styles.workspacesSection}`}>
      <div className={styles.sectionIntro}>
        <SectionLabel>Tenant architecture</SectionLabel>
        <h2 className={styles.sectionHeading}>
          Your organization.<br />
          <span className={styles.serifAccent}>Your workspace.</span>
        </h2>
        <p className={styles.sectionParagraph}>
          Every organization operates in its own branded WorkPulse workspace, backed by strict server-enforced organization boundaries.
        </p>
      </div>

      <div className={styles.workspacesShowcase}>
        <div className={styles.workspacesHeaderBar}>
          <div className={styles.workspacesHeaderTitle}>
            <Globe size={16} />
            <span>Multi-Tenant Workspace Isolation</span>
          </div>
          <span className={styles.workspacesHeaderNote}>Shared core architecture &bull; Dedicated organization identity</span>
        </div>

        <div className={styles.workspacesGrid}>
          {/* Default Platform Gateway */}
          <div className={styles.workspaceCard}>
            <div className={styles.workspaceCardChrome}>
              <span className={styles.workspaceDomain}>auth.workpulse.com</span>
              <span className={styles.workspaceTypeTag}>Platform Gateway</span>
            </div>
            <div className={styles.workspaceCardBody}>
              <div className={styles.workspaceBrandRow}>
                <div className={styles.wpLogoWrap}>
                  <Image
                    src="/branding/workpulse-app-icon.png"
                    alt="WorkPulse Central"
                    width={46}
                    height={46}
                    className={styles.wpLogoImg}
                  />
                </div>
                <div>
                  <small>Platform Default</small>
                  <strong>WorkPulse Central</strong>
                </div>
              </div>
              <p className={styles.workspaceCardSummary}>
                Central authentication gateway, tenant discovery, and administrative workspace routing.
              </p>
              <div className={styles.workspaceFeatureList}>
                <span>&bull; Unified workspace discovery</span>
                <span>&bull; WorkPulse platform styling</span>
              </div>
            </div>
          </div>

          {/* SAGA Pilot Workspace */}
          <div className={`${styles.workspaceCard} ${styles.workspaceCardPilot}`}>
            <div className={styles.workspaceCardChrome}>
              <span className={styles.workspaceDomain}>saga.workpulse.com</span>
              <span className={styles.workspacePilotTag}>Pilot Institution</span>
            </div>
            <div className={styles.workspaceCardBody}>
              <div className={styles.workspaceBrandRow}>
                <div className={styles.sagaLogoWrap}>
                  <Image
                    src="/branding/saga-logo.jpg"
                    alt="St. Aloysius Gonzaga Academy Logo"
                    width={46}
                    height={46}
                    className={styles.sagaLogoImg}
                  />
                </div>
                <div>
                  <small>Institutional Workspace</small>
                  <strong>St. Aloysius Gonzaga Academy</strong>
                </div>
              </div>
              <p className={styles.workspaceCardSummary}>
                Branded academic workspace supporting faculty, staff, and institutional HR operations.
              </p>
              <div className={styles.workspaceFeatureList}>
                <span>&bull; Institutional crest &amp; burgundy theme</span>
                <span>&bull; Isolated institutional personnel records</span>
              </div>
            </div>
          </div>

          {/* Sample Enterprise Workspace */}
          <div className={styles.workspaceCard}>
            <div className={styles.workspaceCardChrome}>
              <span className={styles.workspaceDomain}>meridian.workpulse.com</span>
              <span className={styles.workspaceSampleTag}>Enterprise Example</span>
            </div>
            <div className={styles.workspaceCardBody}>
              <div className={styles.workspaceBrandRow}>
                <div className={styles.meridianMonogram}>M</div>
                <div>
                  <small>Enterprise Workspace</small>
                  <strong>Meridian Technologies</strong>
                </div>
              </div>
              <p className={styles.workspaceCardSummary}>
                Corporate workforce workspace with custom branding, corporate hierarchy, and isolated employee directories.
              </p>
              <div className={styles.workspaceFeatureList}>
                <span>&bull; Custom corporate palette &amp; logo</span>
                <span>&bull; Independent tenant database scope</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.workspaceTraitsBar}>
          <div className={styles.workspaceTraitItem}>
            <ShieldCheck size={16} className={styles.iconMaroon} />
            <span>Isolated employee data</span>
          </div>
          <div className={styles.workspaceTraitItem}>
            <Layers size={16} className={styles.iconMaroon} />
            <span>Branded careers &amp; employee login</span>
          </div>
          <div className={styles.workspaceTraitItem}>
            <Lock size={16} className={styles.iconMaroon} />
            <span>Dedicated organization workspace URL</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function SecuritySection() {
  const safeguards = [
    {
      title: 'Tenant Isolation',
      description: 'Every database query and session is scoped to the verified organization ID. Multi-tenancy is enforced on the server, not in client code.',
      Icon: Lock,
    },
    {
      title: 'Role-Based Access Control',
      description: 'Discrete roles—Organization Admin, HR Admin, Hiring Manager, and Employee—ensure users only view and execute what their responsibilities allow.',
      Icon: KeyRound,
    },
    {
      title: 'Protected Employee Data',
      description: 'Sensitive compensation, identification records, and personnel documents require explicit back-office authorization to access.',
      Icon: ShieldCheck,
    },
    {
      title: 'Authenticated Self-Service',
      description: 'Employees access personal timecards and leave ledgers through restricted sessions with zero exposure to administrative tools.',
      Icon: UserCheck,
    },
    {
      title: 'Audited Operational History',
      description: 'Administrative status transitions, leave approvals, and employee profile updates maintain accountable historical records.',
      Icon: History,
    },
    {
      title: 'Server-Side Authorization',
      description: 'All permissions and data boundaries are evaluated server-side on every request, preventing perimeter bypasses.',
      Icon: Server,
    },
  ] as const;

  return (
    <section id="security" className={`${styles.section} ${styles.securitySection}`}>
      <div className={styles.editorialSplit}>
        <div className={styles.securityIntro}>
          <SectionLabel inverse>Security &amp; Boundaries</SectionLabel>
          <h2 className={styles.sectionHeadingDark}>
            Built around<br />
            <span className={styles.serifAccentSand}>organizational boundaries.</span>
          </h2>
          <p className={styles.sectionParagraphDark}>
            Workforce operations demand strict separation. WorkPulse enforces security and isolation at every layer of the platform architecture.
          </p>
        </div>

        <div className={styles.securityGrid}>
          {safeguards.map(({ title, description, Icon }) => (
            <div className={styles.securityCard} key={title}>
              <div className={styles.securityIconBox}>
                <Icon size={18} strokeWidth={1.8} />
              </div>
              <h3 className={styles.securityCardTitle}>{title}</h3>
              <p className={styles.securityCardText}>{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta({ workspaceUrl }: { workspaceUrl: string }) {
  return (
    <section className={styles.finalCtaSection}>
      <div className={styles.finalCtaBox}>
        <div className={styles.finalCtaContent}>
          <p className={styles.ctaKicker}>WorkPulse Workforce Platform</p>
          <h2 className={styles.finalCtaTitle}>
            Ready to bring your workforce<br />
            <span className={styles.serifAccent}>into one connected system?</span>
          </h2>
          <p className={styles.finalCtaSubtitle}>
            Unify hiring, employee records, attendance, leave, and self-service within a dedicated workspace built for your organization.
          </p>
          <div className={styles.finalCtaActions}>
            <Link href="/request-demo" className={styles.primaryCtaBtn}>
              Request a demo <ArrowRight size={15} />
            </Link>
            <a href={workspaceUrl} className={styles.secondaryCtaBtnOutline}>
              Find your workspace <ArrowRight size={14} />
            </a>
          </div>
        </div>

        <div className={styles.finalCtaBadgeCard} aria-hidden="true">
          <div className={styles.ctaBadgeHeader}>
            <div className={styles.ctaBadgeLogo}>
              <Image
                src="/branding/workpulse-app-icon.png"
                alt="WorkPulse"
                width={40}
                height={40}
                className={styles.ctaBadgeLogoImg}
              />
            </div>
            <div>
              <strong>WorkPulse Platform</strong>
              <small>Dedicated Workspace</small>
            </div>
          </div>
          <div className={styles.ctaBadgeBody}>
            <div className={styles.ctaBadgeRow}>
              <span>Organization Scope</span>
              <strong>Server-Enforced</strong>
            </div>
            <div className={styles.ctaBadgeRow}>
              <span>Employee Records</span>
              <strong className={styles.textSuccess}>Fully Connected</strong>
            </div>
            <div className={styles.ctaBadgeRow}>
              <span>Self-Service</span>
              <strong>Active &amp; Scoped</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer({ workspaceUrl }: { workspaceUrl: string }) {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContent}>
        <div className={styles.footerBrandBlock}>
          <Brand inverse />
          <p className={styles.footerTagline}>
            Connected workforce operations for modern organizations.
          </p>
          <span className={styles.footerBrandMeta}>
            SaaS Multi-Tenant Architecture &bull; Dedicated Workspaces
          </span>
        </div>

        <div className={styles.footerNavColumns}>
          <div className={styles.footerColumn}>
            <h4>Product</h4>
            <Link href="#features">Features</Link>
            <Link href="#lifecycle">Employee Journey</Link>
            <Link href="#modules">Modules</Link>
            <Link href="#security">Security</Link>
          </div>

          <div className={styles.footerColumn}>
            <h4>Access</h4>
            <a href={workspaceUrl}>Find Workspace</a>
            <a href={workspaceUrl}>Sign In</a>
          </div>

          <div className={styles.footerColumn}>
            <h4>Company</h4>
            <Link href="/request-demo">Request Demo</Link>
          </div>
        </div>
      </div>

      <div className={styles.footerBottom}>
        <span>&copy; {new Date().getFullYear()} WorkPulse. All rights reserved.</span>
        <span>Workforce operations, connected.</span>
      </div>
    </footer>
  );
}

export default function HomePage() {
  const workspaceUrl = discoveryOrigin();
  return (
    <div className={`wp-public-shell ${styles.page}`}>
      <a className={styles.skipLink} href="#main-content">
        Skip to main content
      </a>
      <LandingNavbar workspaceUrl={workspaceUrl} />
      <main id="main-content">
        <Hero workspaceUrl={workspaceUrl} />
        <RecordsSection />
        <LifecycleSection />
        <ModulesSection />
        <WorkspacesSection />
        <SecuritySection />
        <FinalCta workspaceUrl={workspaceUrl} />
      </main>
      <Footer workspaceUrl={workspaceUrl} />
    </div>
  );
}
