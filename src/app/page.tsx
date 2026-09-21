import Link from 'next/link';
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarCheck2,
  Check,
  ChevronRight,
  Clock3,
  FileSearch,
  Fingerprint,
  History,
  KeyRound,
  Lock,
  Menu,
  Server,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UsersRound,
} from 'lucide-react';
import { discoveryOrigin } from '@/lib/tenant/host';
import styles from './landing.module.css';

const lifecycleStages = [
  {
    number: '01',
    title: 'Hiring',
    status: 'Live' as const,
    copy: 'AI-assisted resume parsing, requirement matching, and interview pipelines feeding directly into onboarding.',
    tags: ['Resume Parsing', 'Applicant Tracking', 'Interview Workflow'],
  },
  {
    number: '02',
    title: 'Active Employment',
    status: 'Live' as const,
    copy: 'Centralized employee records, probation tracking, schedule-aware attendance, and leave management.',
    tags: ['Employee Dossiers', 'Probation Milestones', 'Attendance & Leave'],
  },
  {
    number: '03',
    title: 'Exit',
    status: 'Planned' as const,
    copy: 'A structured post-employment transition framework for clearance, asset handover, and final record archiving.',
    tags: ['Clearance Workflow', 'Asset Handover', 'Post-Employment Records'],
  },
] as const;

const faqItems = [
  {
    question: 'What is WorkPulse?',
    answer:
      'WorkPulse is a multi-tenant workforce management and HR platform built for schools, educational institutions, and enterprises. It unifies the employee journey—from recruitment and applicant tracking through employee records, probation evaluation, schedule-aware attendance, leave management, and employee self-service.',
  },
  {
    question: 'Can each organization have its own workspace?',
    answer:
      'Yes. Each organization operates on its own dedicated WorkPulse subdomain (for example, saga.workpulse.com). The platform enforces tenant isolation through organizationId scoping and server-side authorization so that organizational data remains strictly segregated.',
  },
  {
    question: 'Can organizations customize their branding?',
    answer:
      'Yes. Organization Admins can set their organization’s legal display name, official logo, and primary and accent brand colors to match their institution’s identity across both administrative and employee-facing views.',
  },
  {
    question: 'Does AI make hiring decisions?',
    answer:
      'No. AI assists with document parsing and requirement matching to highlight relevant qualifications from candidate resumes. Hiring authority and final employment decisions remain strictly in the hands of HR Admins and Hiring Managers.',
  },
  {
    question: 'Can employees access WorkPulse?',
    answer:
      'Yes. Through Employee Self-Service (ESS), staff and faculty can securely access their individual profiles, view scheduled shifts and attendance logs, and submit leave requests directly from any web browser without access to administrative dashboards.',
  },
  {
    question: 'Which modules are available now?',
    answer:
      'The currently live modules include AI-assisted recruitment, applicant tracking, interview workflows, digital onboarding, employee records, probation management, schedule-aware attendance, leave management, and Employee Self-Service (ESS).',
  },
  {
    question: 'Which features are planned for future releases?',
    answer:
      'Planned roadmap modules include H6 Payroll calculation and payslip distribution, RFID hardware clock-in integration, Workforce Analytics reporting, and structured Exit / Post-Employment management.',
  },
] as const;

function BrandWordmark() {
  return (
    <Link href="/" className={styles.brand} aria-label="WorkPulse Home">
      <span className={styles.brandMonogram} aria-hidden="true">
        W
      </span>
      <span>WorkPulse</span>
    </Link>
  );
}

function Navbar({ workspaceUrl }: { workspaceUrl: string }) {
  return (
    <header className={styles.header}>
      <div className={styles.navbar}>
        <BrandWordmark />

        <nav aria-label="Primary navigation" className={styles.desktopNav}>
          <Link href="#features">Features</Link>
          <Link href="#lifecycle">How It Works</Link>
          <Link href="#security">Security</Link>
          <Link href="/features">Modules</Link>
        </nav>

        <div className={styles.navActions}>
          <a href={workspaceUrl} className={styles.navGhostBtn}>
            Find Workspace / Sign In
          </a>
          <Link href="/request-demo" className={styles.navPrimaryBtn}>
            <span>Request Demo</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        <details className={styles.mobileMenu}>
          <summary aria-label="Toggle navigation menu">
            <Menu size={20} strokeWidth={2} />
          </summary>
          <nav aria-label="Mobile navigation" className={styles.mobilePanel}>
            <Link href="#features">Features</Link>
            <Link href="#lifecycle">How It Works</Link>
            <Link href="#security">Security</Link>
            <Link href="/features">All Capabilities</Link>
            <a href={workspaceUrl}>Find Workspace / Sign In</a>
            <Link href="/request-demo" className={styles.mobilePanelPrimary}>
              Request Demo
            </Link>
          </nav>
        </details>
      </div>
    </header>
  );
}

function HeroShowcase() {
  return (
    <div className={styles.showcaseWrapper} aria-label="WorkPulse HR Workspace Interface Preview">
      <div className={styles.outerFrame}>
        <div className={styles.innerCore}>
          {/* Window Chrome */}
          <div className={styles.windowBar}>
            <div className={styles.windowControls} aria-hidden="true">
              <span className={styles.windowDot} />
              <span className={styles.windowDot} />
              <span className={styles.windowDot} />
            </div>
            <div className={styles.workspaceBadge}>
              <Building2 size={13} />
              <span>saga.workpulse.com</span>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>/</span>
              <span>People Operations</span>
            </div>
            <div className={styles.userRolePill}>
              <span className={styles.heroEyebrowDot} />
              <span>HR Admin</span>
            </div>
          </div>

          {/* Product App Layout */}
          <div className={styles.appLayout}>
            {/* Sidebar Rail */}
            <aside className={styles.appSidebar} aria-label="App Preview Navigation">
              <span className={styles.sidebarLabel}>Workforce</span>
              <div className={`${styles.sidebarItem} ${styles.sidebarItemActive}`}>
                <UsersRound />
                <span>Employee Records</span>
              </div>
              <div className={styles.sidebarItem}>
                <BriefcaseBusiness />
                <span>Recruitment</span>
              </div>
              <div className={styles.sidebarItem}>
                <Clock3 />
                <span>Attendance</span>
              </div>
              <div className={styles.sidebarItem}>
                <CalendarCheck2 />
                <span>Leave</span>
              </div>
              <div className={styles.sidebarItem}>
                <Fingerprint />
                <span>Self-Service</span>
              </div>
            </aside>

            {/* App Canvas */}
            <div className={styles.appCanvas}>
              {/* Directory List Card */}
              <div className={styles.directoryCard}>
                <div className={styles.cardHeader}>
                  <div>
                    <span className={styles.cardHeaderTitle}>Staff & Faculty Directory</span>
                  </div>
                  <span className={styles.cardHeaderBadge}>Active Department</span>
                </div>

                <div className={styles.searchMock}>
                  <UsersRound size={14} />
                  <span>Search employee name, department, or ID...</span>
                </div>

                <div className={styles.employeeList}>
                  <div className={`${styles.employeeRow} ${styles.employeeRowSelected}`}>
                    <div className={styles.employeeMeta}>
                      <div className={styles.avatarCircle}>EV</div>
                      <div>
                        <div className={styles.employeeName}>Elena Vance</div>
                        <div className={styles.employeeRole}>Systems Analyst • IT Dept</div>
                      </div>
                    </div>
                    <span className={styles.statusPillActive}>
                      <Check size={11} strokeWidth={3} /> Active
                    </span>
                  </div>

                  <div className={styles.employeeRow}>
                    <div className={styles.employeeMeta}>
                      <div className={styles.avatarCircle} style={{ background: '#1e3a8a' }}>
                        MR
                      </div>
                      <div>
                        <div className={styles.employeeName}>Marcus Reyes</div>
                        <div className={styles.employeeRole}>Faculty Instructor • Math Dept</div>
                      </div>
                    </div>
                    <span className={styles.statusPillProbation}>
                      <Clock3 size={11} /> Probation
                    </span>
                  </div>

                  <div className={styles.employeeRow}>
                    <div className={styles.employeeMeta}>
                      <div className={styles.avatarCircle} style={{ background: '#334155' }}>
                        CS
                      </div>
                      <div>
                        <div className={styles.employeeName}>Carla Santos</div>
                        <div className={styles.employeeRole}>Academic Coordinator • Admin</div>
                      </div>
                    </div>
                    <span className={styles.statusPillActive}>
                      <Check size={11} strokeWidth={3} /> Active
                    </span>
                  </div>
                </div>
              </div>

              {/* Detail Dossier Card */}
              <div className={styles.dossierCard}>
                <div className={styles.dossierHeader}>
                  <div className={styles.dossierProfile}>
                    <div className={styles.dossierAvatar}>EV</div>
                    <div>
                      <div className={styles.dossierTitle}>Elena Vance</div>
                      <div className={styles.dossierSubtitle}>Employee ID: WP-2024-0104 • Full-Time Regular</div>
                    </div>
                  </div>
                  <span className={styles.statusPillActive}>Regular Status</span>
                </div>

                <div className={styles.tabPillRow}>
                  <span className={`${styles.tabPill} ${styles.tabPillSelected}`}>Overview</span>
                  <span className={styles.tabPill}>Attendance Logs</span>
                  <span className={styles.tabPill}>Leave Balances</span>
                </div>

                <div className={styles.dossierGrid}>
                  <div className={styles.dossierField}>
                    <div className={styles.fieldLabel}>Department & Role</div>
                    <div className={styles.fieldValue}>Information Technology • Analyst</div>
                  </div>
                  <div className={styles.dossierField}>
                    <div className={styles.fieldLabel}>Probation Review</div>
                    <div className={styles.fieldValue}>Completed • Regularized</div>
                  </div>
                  <div className={styles.dossierField}>
                    <div className={styles.fieldLabel}>Current Schedule</div>
                    <div className={styles.fieldValue}>Mon – Fri • 08:00 – 17:00</div>
                  </div>
                  <div className={styles.dossierField}>
                    <div className={styles.fieldLabel}>ESS Portal Status</div>
                    <div className={styles.fieldValue}>Active & Verified</div>
                  </div>
                </div>

                <div className={styles.syncActivityBox}>
                  <div className={styles.syncActivityItem}>
                    <div>
                      <div className={styles.syncActivityItemTitle}>Today’s Attendance Record</div>
                      <div className={styles.syncActivityItemDesc}>Schedule-aware entry verified at 08:02 AM</div>
                    </div>
                    <span className={styles.statusPillActive}>On Time</span>
                  </div>

                  <div className={styles.syncActivityItem} style={{ borderLeftColor: '#0ea5e9' }}>
                    <div>
                      <div className={styles.syncActivityItemTitle}>Annual Leave Balance</div>
                      <div className={styles.syncActivityItemDesc}>12.0 Days Available • 2 Requests Approved</div>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#0369a1' }}>Up to date</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating AI Verification Insight Badge */}
      <div className={styles.floatingInsightBadge} aria-label="AI-Assisted Recruitment Insight Preview">
        <div className={styles.insightIconBox}>
          <Sparkles size={20} />
        </div>
        <div>
          <div className={styles.insightTitle}>
            <span>AI-Assisted Matching</span>
            <span className={styles.statusPillActive} style={{ padding: '2px 6px', fontSize: '10px' }}>
              Verified
            </span>
          </div>
          <div className={styles.insightDesc}>
            Resume parsed • Requirements matched • HR review required before decision.
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero({ workspaceUrl }: { workspaceUrl: string }) {
  return (
    <section className={styles.hero}>
      <div className={styles.heroHeader}>
        <div className={styles.heroEyebrow}>
          <span className={styles.heroEyebrowDot} />
          <span>Workforce & HR Operations SaaS</span>
        </div>

        <h1 className={styles.heroTitle}>Manage your workforce from hiring to exit.</h1>

        <p className={styles.heroSubtitle}>
          WorkPulse connects hiring workflows, employee records, schedule-aware attendance, leave management, and
          employee self-service into one dependable operating system.
        </p>

        <div className={styles.heroActions}>
          <Link href="/request-demo" className={styles.primaryCtaBtn}>
            <span>Request Demo</span>
            <div className={styles.btnIconCircle}>
              <ArrowRight size={14} />
            </div>
          </Link>
          <a href={workspaceUrl} className={styles.secondaryCtaBtn}>
            Find Workspace / Sign In
          </a>
        </div>
      </div>

      <HeroShowcase />
    </section>
  );
}

function RecordsSection() {
  return (
    <section id="features" className={styles.recordSection}>
      <div className={styles.splitGrid}>
        <div>
          <span className={styles.sectionEyebrow}>
            <UsersRound size={15} />
            <span>Single Source of Truth</span>
          </span>
          <h2 className={styles.sectionHeading}>Keep every employee record connected.</h2>
          <p className={styles.sectionParagraph}>
            Fragmented spreadsheets and disjointed tools create administrative blind spots. WorkPulse anchors every
            operational event to a single employee dossier that stays synchronized across shifts, leave filings, and
            organizational milestones.
          </p>

          <div className={styles.featureBulletList}>
            <div className={styles.featureBullet}>
              <div className={styles.bulletIcon}>
                <Check size={14} strokeWidth={3} />
              </div>
              <div>
                <div className={styles.bulletTitle}>Employment History & Probation Tracking</div>
                <div className={styles.bulletDesc}>
                  Track appointment dates, job titles, department assignments, and probationary evaluation periods
                  with timely alerts for HR review.
                </div>
              </div>
            </div>

            <div className={styles.featureBullet}>
              <div className={styles.bulletIcon}>
                <Check size={14} strokeWidth={3} />
              </div>
              <div>
                <div className={styles.bulletTitle}>Schedule-Aware Attendance Verification</div>
                <div className={styles.bulletDesc}>
                  Attendance logs respect shift timetables, grace periods, and break policies with instant visibility for
                  HR Admins.
                </div>
              </div>
            </div>

            <div className={styles.featureBullet}>
              <div className={styles.bulletIcon}>
                <Check size={14} strokeWidth={3} />
              </div>
              <div>
                <div className={styles.bulletTitle}>Direct Employee Self-Service Access</div>
                <div className={styles.bulletDesc}>
                  Employees view approved records, filed leave slips, and attendance history without accessing
                  administrative tools.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dossier Mockup Container */}
        <div className={styles.splitVisualContainer} aria-label="Employee Record Dossier Preview">
          <div className={styles.dossierCard} style={{ boxShadow: 'none', border: '1px solid #cbd5e1' }}>
            <div className={styles.dossierHeader}>
              <div className={styles.dossierProfile}>
                <div className={styles.dossierAvatar} style={{ background: '#0b1528' }}>
                  CS
                </div>
                <div>
                  <div className={styles.dossierTitle}>Carla Santos</div>
                  <div className={styles.dossierSubtitle}>Employee ID: WP-2023-0082 • Academic Coordinator</div>
                </div>
              </div>
              <span className={styles.statusPillActive}>Active Regular</span>
            </div>

            <div className={styles.dossierGrid}>
              <div className={styles.dossierField}>
                <div className={styles.fieldLabel}>Department</div>
                <div className={styles.fieldValue}>Academic Affairs</div>
              </div>
              <div className={styles.dossierField}>
                <div className={styles.fieldLabel}>Hire Date</div>
                <div className={styles.fieldValue}>August 15, 2023</div>
              </div>
              <div className={styles.dossierField}>
                <div className={styles.fieldLabel}>Assigned Schedule</div>
                <div className={styles.fieldValue}>08:00 – 17:00 (Standard)</div>
              </div>
              <div className={styles.dossierField}>
                <div className={styles.fieldLabel}>Probation Decision</div>
                <div className={styles.fieldValue}>Passed & Permanent</div>
              </div>
            </div>

            <div className={styles.dossierTimelinePreview}>
              <div className={styles.timelineHeading}>Connected Lifecycle Continuity</div>
              <div className={styles.timelineTrack}>
                <div className={styles.timelineNode}>
                  <div className={styles.timelineNodeState}>Applied</div>
                  <div className={styles.timelineNodeTitle}>Resume Parsed</div>
                </div>
                <div className={styles.timelineNode}>
                  <div className={styles.timelineNodeState}>Onboarded</div>
                  <div className={styles.timelineNodeTitle}>Contract Signed</div>
                </div>
                <div className={styles.timelineNode}>
                  <div className={styles.timelineNodeState}>Probation</div>
                  <div className={styles.timelineNodeTitle}>Regularized</div>
                </div>
                <div className={styles.timelineNode}>
                  <div className={styles.timelineNodeState}>Live Ops</div>
                  <div className={styles.timelineNodeTitle}>Attendance & Leave</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LifecycleSection() {
  return (
    <section id="lifecycle" className={styles.lifecycleSection}>
      <div className={styles.lifecycleHeader}>
        <span className={styles.sectionEyebrow}>
          <Clock3 size={15} />
          <span>Continuous Workforce Architecture</span>
        </span>
        <h2 className={styles.sectionHeading}>A continuous journey, not disconnected tools.</h2>
        <p className={styles.sectionParagraph}>
          WorkPulse follows the complete progression of an employee. Data gathered during candidate screening flows
          directly into the active employment dossier, ensuring an unbroken audit history.
        </p>
      </div>

      <div className={styles.lifecycleTrack}>
        {lifecycleStages.map((stage) => {
          const isPlanned = stage.status === 'Planned';
          return (
            <div key={stage.number} className={styles.lifecycleStepCard}>
              <div className={styles.stepNodeHeader}>
                <div
                  className={`${styles.stepNumberCircle} ${isPlanned ? styles.stepNumberCirclePlanned : ''}`}
                >
                  {stage.number}
                </div>
                {isPlanned ? (
                  <span className={styles.stepStatusPlanned}>Planned Roadmap</span>
                ) : (
                  <span className={styles.stepStatusLive}>Available Now</span>
                )}
              </div>

              <h3 className={styles.stepTitle}>{stage.title}</h3>
              <p className={styles.stepCopy}>{stage.copy}</p>

              <div className={styles.stepSubitems}>
                {stage.tags.map((tag) => (
                  <span key={tag} className={styles.stepTag}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ModuleNetworkSection() {
  return (
    <section className={styles.moduleSection}>
      <div className={styles.moduleGrid}>
        <div>
          <span className={styles.sectionEyebrow}>
            <BriefcaseBusiness size={15} />
            <span>Platform Ecosystem</span>
          </span>
          <h2 className={styles.sectionHeading}>One employee record powers every module.</h2>
          <p className={styles.sectionParagraph}>
            Instead of managing disconnected databases for recruitment, attendance, and leave, WorkPulse organizes
            operations around the core Employee Record. All modules share the same authorization rules and organization
            boundaries.
          </p>

          <div style={{ marginTop: '28px' }}>
            <Link
              href="/features"
              className={styles.primaryCtaBtn}
              style={{ background: '#0f1f38', padding: '10px 20px', fontSize: '14px' }}
            >
              <span>Explore All Current Capabilities</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Clean Visual Hub and Spoke Network */}
        <div className={styles.hubNetworkContainer} aria-label="WorkPulse Module Network">
          <div className={styles.hubCenter}>
            <div className={styles.hubCenterEyebrow}>Core Authoritative Entity</div>
            <div className={styles.hubCenterTitle}>Employee Record</div>
          </div>

          <div className={styles.liveSpokeGrid}>
            <div className={`${styles.spokeNode} ${styles.spokeTopLeft}`}>
              <BriefcaseBusiness />
              <span>Hiring & ATS</span>
            </div>
            <div className={`${styles.spokeNode} ${styles.spokeTopRight}`}>
              <Clock3 />
              <span>Attendance Tracking</span>
            </div>
            <div className={`${styles.spokeNode} ${styles.spokeBottomLeft}`}>
              <CalendarCheck2 />
              <span>Leave Management</span>
            </div>
            <div className={`${styles.spokeNode} ${styles.spokeBottomRight}`}>
              <UsersRound />
              <span>Employee Self-Service</span>
            </div>
          </div>

          <div className={styles.plannedSpokeBar}>
            <span className={styles.plannedSpokeTag}>
              Payroll Engine <span className={styles.plannedBadgeMini}>Planned</span>
            </span>
            <span className={styles.plannedSpokeTag}>
              RFID Clock-In <span className={styles.plannedBadgeMini}>Planned</span>
            </span>
            <span className={styles.plannedSpokeTag}>
              Workforce Analytics <span className={styles.plannedBadgeMini}>Planned</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function AiHiringSection() {
  const steps = [
    { label: 'Resume Ingestion', desc: 'Secure PDF/DOCX upload directly to organization talent pool.', icon: FileSearch },
    { label: 'AI Extraction', desc: 'Extraction of employment history, skills, and educational background.', icon: Sparkles },
    { label: 'Requirement Match', desc: 'Evidence comparison against job criteria for candidate fit.', icon: Fingerprint },
    { label: 'HR Review', desc: 'HR Admin and Hiring Manager evaluate evidence and interview notes.', icon: UserCheck },
    { label: 'Human Decision', desc: 'Final hiring authority and offer release made strictly by people.', icon: Check },
  ] as const;

  return (
    <section className={styles.aiSection}>
      <div style={{ maxWidth: '780px', marginInline: 'auto', textAlign: 'center' }}>
        <span className={styles.sectionEyebrow}>
          <Sparkles size={15} />
          <span>Assisted Intelligence</span>
        </span>
        <h2 className={styles.sectionHeading}>AI assists. HR decides.</h2>
        <p className={styles.sectionParagraph} style={{ marginInline: 'auto' }}>
          WorkPulse accelerates administrative screening by extracting resume data and highlighting relevant qualifications.
          The platform never automates rejections or hiring choices: people maintain 100% accountability.
        </p>
      </div>

      <div className={styles.aiFlowGrid}>
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isFinal = idx === steps.length - 1;
          return (
            <div key={step.label} className={`${styles.aiStepCard} ${isFinal ? styles.humanDecisionCard : ''}`}>
              <div className={styles.aiStepIconBox}>
                <Icon />
              </div>
              <div className={styles.aiStepTitle}>{step.label}</div>
              <div className={styles.aiStepDesc}>{step.desc}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MultiTenantSection() {
  return (
    <section className={styles.tenantSection}>
      <div style={{ maxWidth: '820px', marginInline: 'auto', textAlign: 'center' }}>
        <span className={styles.sectionEyebrow}>
          <Building2 size={15} />
          <span>Enterprise Multi-Tenancy</span>
        </span>
        <h2 className={styles.sectionHeading}>One platform. Dedicated organization workspaces.</h2>
        <p className={styles.sectionParagraph} style={{ marginInline: 'auto' }}>
          Each organization operates in its own isolated WorkPulse workspace, with server-enforced organization boundaries.
          Workspaces enjoy tailored branding, distinct hostnames, and independent role authorizations.
        </p>
      </div>

      <div className={styles.tenantShowcaseGrid}>
        {/* Pilot Tenant Preview */}
        <div className={styles.tenantPreviewPanel}>
          <div className={styles.tenantPanelHeader}>
            <div className={styles.tenantPanelSubdomain}>
              <span className={styles.tenantSubdomainDot} style={{ background: '#742a2a' }} />
              <span>saga.workpulse.com</span>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Pilot Academy Workspace</span>
          </div>

          <div className={styles.tenantPanelContent}>
            <div className={styles.tenantBrandBadge}>
              <div className={styles.tenantOrgLogo} style={{ background: '#742a2a' }}>
                S
              </div>
              <div>
                <div className={styles.tenantOrgName}>St. Aloysius Gonzaga Academy, Inc.</div>
                <div className={styles.tenantOrgMeta}>Dedicated Academic Workspace • 64 Active Personnel</div>
              </div>
            </div>

            <div className={styles.tenantThemeBar}>
              <span className={styles.tenantThemeLabel}>Applied Workspace Theme</span>
              <div className={styles.tenantColorSwatches}>
                <span className={styles.colorSwatch} style={{ background: '#742a2a' }} title="Primary Color" />
                <span className={styles.colorSwatch} style={{ background: '#b68b2c' }} title="Accent Color" />
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginLeft: '6px' }}>
                  Custom Institutional Brand
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Enterprise Tenant Preview */}
        <div className={styles.tenantPreviewPanel}>
          <div className={styles.tenantPanelHeader}>
            <div className={styles.tenantPanelSubdomain}>
              <span className={styles.tenantSubdomainDot} style={{ background: '#167d77' }} />
              <span>northfield.workpulse.com</span>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>Enterprise Workspace</span>
          </div>

          <div className={styles.tenantPanelContent}>
            <div className={styles.tenantBrandBadge}>
              <div className={styles.tenantOrgLogo} style={{ background: '#17324d' }}>
                N
              </div>
              <div>
                <div className={styles.tenantOrgName}>Northfield Manufacturing</div>
                <div className={styles.tenantOrgMeta}>Multi-Facility Operations • 180 Active Personnel</div>
              </div>
            </div>

            <div className={styles.tenantThemeBar}>
              <span className={styles.tenantThemeLabel}>Applied Workspace Theme</span>
              <div className={styles.tenantColorSwatches}>
                <span className={styles.colorSwatch} style={{ background: '#17324d' }} title="Primary Color" />
                <span className={styles.colorSwatch} style={{ background: '#167d77' }} title="Accent Color" />
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginLeft: '6px' }}>
                  Industrial Enterprise Palette
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function EssSection() {
  return (
    <section className={styles.essSection}>
      <div className={styles.essContainer}>
        <div>
          <span className={styles.sectionEyebrow}>
            <UsersRound size={15} />
            <span>Employee Self-Service (ESS)</span>
          </span>
          <h2 className={styles.sectionHeading}>Self-service that stays in the employee’s lane.</h2>
          <p className={styles.sectionParagraph}>
            Empower your faculty and staff to take control of their own employment details without burdening HR.
            Employees can check their clock-in records, view remaining leave credits, and submit time-off filings in
            seconds from any device.
          </p>

          <div className={styles.featureBulletList}>
            <div className={styles.featureBullet}>
              <div className={styles.bulletIcon}>
                <Check size={14} strokeWidth={3} />
              </div>
              <div>
                <div className={styles.bulletTitle}>My Profile Overview</div>
                <div className={styles.bulletDesc}>
                  Securely view verified employment details, assigned department, and supervisor info.
                </div>
              </div>
            </div>
            <div className={styles.featureBullet}>
              <div className={styles.bulletIcon}>
                <Check size={14} strokeWidth={3} />
              </div>
              <div>
                <div className={styles.bulletTitle}>My Attendance History</div>
                <div className={styles.bulletDesc}>
                  Transparent access to personal clock-in and clock-out timestamps with status indicators.
                </div>
              </div>
            </div>
            <div className={styles.featureBullet}>
              <div className={styles.bulletIcon}>
                <Check size={14} strokeWidth={3} />
              </div>
              <div>
                <div className={styles.bulletTitle}>My Leave Requests</div>
                <div className={styles.bulletDesc}>
                  File sick or vacation leave applications and follow review approvals in real time.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Lighter Employee Portal Mockup */}
        <div className={styles.essPortalCard} aria-label="Employee Self-Service Portal Interface Preview">
          <div className={styles.essPortalHeader}>
            <div className={styles.essPortalTitle}>
              <UsersRound size={18} color="#0d9488" />
              <span>Employee Self-Service</span>
            </div>
            <span className={styles.statusPillActive}>Elena Vance (WP-2024-0104)</span>
          </div>

          <div className={styles.essPortalTabs}>
            <div className={`${styles.essTabItem} ${styles.essTabItemActive}`}>
              <UsersRound size={14} /> My Profile
            </div>
            <div className={styles.essTabItem}>
              <Clock3 size={14} /> My Attendance
            </div>
            <div className={styles.essTabItem}>
              <CalendarCheck2 size={14} /> My Leave
            </div>
          </div>

          <div className={styles.essPortalBody}>
            <div className={styles.essBalanceRow}>
              <div className={styles.essBalanceBox}>
                <div className={styles.essBalanceLabel}>Vacation Leave Balance</div>
                <div className={styles.essBalanceValue}>12 Days Remaining</div>
              </div>
              <div className={styles.essBalanceBox}>
                <div className={styles.essBalanceLabel}>Sick Leave Balance</div>
                <div className={styles.essBalanceValue}>8 Days Remaining</div>
              </div>
            </div>

            <div className={styles.syncActivityBox}>
              <div className={styles.syncActivityItem}>
                <div>
                  <div className={styles.syncActivityItemTitle}>Recent Attendance Check</div>
                  <div className={styles.syncActivityItemDesc}>Shift 08:00 – 17:00 • Clocked in at 08:02 AM</div>
                </div>
                <span className={styles.statusPillActive}>On Time</span>
              </div>
              <div className={styles.syncActivityItem} style={{ borderLeftColor: '#f59e0b' }}>
                <div>
                  <div className={styles.syncActivityItemTitle}>Pending Leave Request</div>
                  <div className={styles.syncActivityItemDesc}>Vacation Leave (2 Days) • Awaiting HR Admin Review</div>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#b45309' }}>In Review</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SecuritySection() {
  const securityItems = [
    {
      title: 'Tenant Isolation',
      desc: 'Each organization operates in its own isolated WorkPulse workspace with server-enforced organization boundaries.',
      icon: Lock,
    },
    {
      title: 'Role-Based Access Control',
      desc: 'Permissions follow designated roles: Organization Admin, HR Admin, Hiring Manager, and Employee.',
      icon: KeyRound,
    },
    {
      title: 'Audit History',
      desc: 'Audit history for sensitive actions retains accountable evidence across employment events.',
      icon: History,
    },
    {
      title: 'Server-Side Authorization',
      desc: 'All security policies are validated and enforced on the server for complete data integrity.',
      icon: Server,
    },
  ] as const;

  return (
    <section id="security" className={styles.securitySection}>
      <div style={{ maxWidth: '780px', marginInline: 'auto', textAlign: 'center' }}>
        <span className={styles.sectionEyebrow}>
          <ShieldCheck size={15} />
          <span>Architectural Integrity</span>
        </span>
        <h2 className={styles.sectionHeading}>Security grounded in access control.</h2>
        <p className={styles.sectionParagraph} style={{ marginInline: 'auto' }}>
          Workforce data demands disciplined protection. WorkPulse enforces strict multi-tenant scoping and zero-trust
          permission evaluation across all operations.
        </p>
      </div>

      <div className={styles.securityGrid}>
        {securityItems.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.title} className={styles.securityCard}>
              <div className={styles.securityIconCircle}>
                <Icon size={20} />
              </div>
              <div className={styles.securityTitle}>{item.title}</div>
              <div className={styles.securityDesc}>{item.desc}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function TrustSection() {
  const trustPillars = [
    {
      number: '01',
      title: 'Centralized Records',
      desc: 'Single source of truth linking candidate applications to active employment records and attendance.',
    },
    {
      number: '02',
      title: 'Clear Workflows',
      desc: 'Structured progression for probation evaluations, hiring approvals, and employee leave requests.',
    },
    {
      number: '03',
      title: 'Controlled Access',
      desc: 'Strict role hierarchy ensures staff and faculty only see the information relevant to their responsibility.',
    },
    {
      number: '04',
      title: 'Organization Identity',
      desc: 'Customizable workspace branding gives each educational or corporate tenant its own digital home.',
    },
  ] as const;

  return (
    <section className={styles.trustSection}>
      <div className={styles.trustGrid}>
        <div>
          <span className={styles.sectionEyebrow}>
            <Building2 size={15} />
            <span>Operational Rigor</span>
          </span>
          <h2 className={styles.sectionHeading}>
            Built for organizations that need structured workforce operations.
          </h2>
          <p className={styles.sectionParagraph}>
            Whether managing a private educational institution with varied academic schedules or an enterprise with multiple
            departments, WorkPulse delivers reliability without operational overhead.
          </p>
        </div>

        <div className={styles.trustCardList}>
          {trustPillars.map((pillar) => (
            <div key={pillar.number} className={styles.trustCard}>
              <div className={styles.trustCardNumber}>{pillar.number}</div>
              <div className={styles.trustCardTitle}>{pillar.title}</div>
              <div className={styles.trustCardDesc}>{pillar.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section className={styles.faqSection}>
      <div className={styles.faqSplitGrid}>
        <div className={styles.faqStickyIntro}>
          <span className={styles.sectionEyebrow}>
            <ShieldCheck size={15} />
            <span>Clarity & Answers</span>
          </span>
          <h2 className={styles.sectionHeading}>Frequently asked questions.</h2>
          <p className={styles.sectionParagraph}>
            Everything you need to know about WorkPulse’s multi-tenant architecture, AI assistance model, and available capabilities.
          </p>
        </div>

        <div className={styles.faqList}>
          {faqItems.map((item, idx) => (
            <details key={item.question} className={styles.faqItem} open={idx === 0}>
              <summary className={styles.faqSummary}>
                <span>{item.question}</span>
                <span className={styles.faqIconToggle} aria-hidden="true" />
              </summary>
              <div className={styles.faqAnswer}>{item.answer}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCtaSection({ workspaceUrl }: { workspaceUrl: string }) {
  return (
    <section className={styles.finalCtaSection}>
      <div className={styles.finalCtaBox}>
        <div>
          <h2 className={styles.finalCtaHeading}>Bring your workforce operations into one platform.</h2>
          <p className={styles.finalCtaSubtitle}>
            Connect the entire employee lifecycle with an isolated workspace engineered specifically for your
            organization.
          </p>
        </div>

        <div className={styles.finalCtaActions}>
          <Link href="/request-demo" className={styles.ctaLightBtn}>
            <span>Request Demo</span>
            <ArrowRight size={15} />
          </Link>
          <a href={workspaceUrl} className={styles.ctaGhostWhiteBtn}>
            Find Workspace / Sign In
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer({ workspaceUrl }: { workspaceUrl: string }) {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContent}>
        <div className={styles.footerBrandColumn}>
          <BrandWordmark />
          <p className={styles.footerDesc}>
            AI-Assisted Human Resource and Workforce Operations SaaS platform for educational institutions and enterprises.
          </p>
        </div>

        <nav aria-label="Footer navigation" className={styles.footerNav}>
          <Link href="#features">Features</Link>
          <Link href="#lifecycle">How It Works</Link>
          <Link href="#security">Security</Link>
          <Link href="/features">All Modules</Link>
          <a href={workspaceUrl}>Find Workspace</a>
          <Link href="/request-demo">Request Demo</Link>
        </nav>
      </div>

      <div className={styles.footerBottom}>
        <div>&copy; {new Date().getFullYear()} WorkPulse SaaS Platform. All rights reserved.</div>
        <div style={{ display: 'flex', gap: '20px' }}>
          <span>Tenant Isolation</span>
          <span>Role-Based Access</span>
          <span>Server-Side Authorization</span>
        </div>
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

      <Navbar workspaceUrl={workspaceUrl} />

      <main id="main-content">
        <Hero workspaceUrl={workspaceUrl} />
        <RecordsSection />
        <LifecycleSection />
        <ModuleNetworkSection />
        <AiHiringSection />
        <MultiTenantSection />
        <EssSection />
        <SecuritySection />
        <TrustSection />
        <FaqSection />
        <FinalCtaSection workspaceUrl={workspaceUrl} />
      </main>

      <Footer workspaceUrl={workspaceUrl} />
    </div>
  );
}
