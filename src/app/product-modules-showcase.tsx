'use client';

import { useState } from 'react';
import { BriefcaseBusiness, UsersRound, Clock3, CalendarCheck2, CreditCard, UserCheck, Check, ArrowRight, FileText, CheckCircle2, Shield } from 'lucide-react';
import styles from './landing.module.css';

interface ModuleItem {
  id: string;
  number: string;
  title: string;
  category: string;
  summary: string;
  details: string[];
  uiFragment: React.ReactNode;
}

export function ProductModulesShowcase() {
  const [activeModule, setActiveModule] = useState(0);

  const modules: ModuleItem[] = [
    {
      id: 'hiring',
      number: '01',
      title: 'Hiring',
      category: 'Recruitment & Intake',
      summary: 'Recruit applicants, review qualifications, and transition successful hires directly into official employee records.',
      details: [
        'Structured resume parsing with qualification matching',
        'Multi-stage interview workflows with HR sign-off',
        'One-click transition from candidate to employee record',
      ],
      uiFragment: (
        <div className={styles.authenticPreviewCard}>
          <div className={styles.previewCardHeader}>
            <div className={styles.previewCardBadge}>
              <BriefcaseBusiness size={14} />
              <span>Candidate Evaluation</span>
            </div>
            <span className={styles.previewStatusSuccess}>Offer Accepted</span>
          </div>
          <div className={styles.previewCandidateProfile}>
            <div className={styles.previewCandidateAvatar}>MV</div>
            <div>
              <p className={styles.previewCandidateName}>Marco Valerio</p>
              <p className={styles.previewCandidateRole}>Senior Systems Engineer &bull; Information Technology</p>
            </div>
          </div>
          <div className={styles.previewMetaGrid}>
            <div className={styles.previewMetaItem}>
              <span>Application Stage</span>
              <strong>Ready for Onboarding</strong>
            </div>
            <div className={styles.previewMetaItem}>
              <span>Requirements Match</span>
              <strong className={styles.textSuccess}>94% Verified</strong>
            </div>
          </div>
          <div className={styles.previewChecklist}>
            <div className={styles.previewCheckRow}>
              <CheckCircle2 size={13} className={styles.iconSuccess} />
              <span>Technical Assessment: Passed (Score: 92/100)</span>
            </div>
            <div className={styles.previewCheckRow}>
              <CheckCircle2 size={13} className={styles.iconSuccess} />
              <span>Pre-employment Credentials: Verified</span>
            </div>
          </div>
          <div className={styles.previewCardFooter}>
            <span className={styles.previewNote}>Destination: Employee Master Records</span>
            <span className={styles.previewActionPill}>Auto-creates Profile</span>
          </div>
        </div>
      ),
    },
    {
      id: 'employees',
      number: '02',
      title: 'Employee Management',
      category: 'Workforce Core',
      summary: 'Maintain centralized employment history, department assignments, probation milestones, and verified identity records.',
      details: [
        'Unified employee master files with permanent history',
        'Automated probation tracking and regular status evaluation',
        'Granular role-based department and position structuring',
      ],
      uiFragment: (
        <div className={styles.authenticPreviewCard}>
          <div className={styles.previewCardHeader}>
            <div className={styles.previewCardBadge}>
              <UsersRound size={14} />
              <span>Master Personnel File</span>
            </div>
            <span className={styles.previewStatusRegular}>Regular</span>
          </div>
          <div className={styles.previewCandidateProfile}>
            <div className={styles.previewCandidateAvatar}>EV</div>
            <div>
              <p className={styles.previewCandidateName}>Elena Vance</p>
              <p className={styles.previewCandidateRole}>WP-2024-0089 &bull; IT Operations Lead</p>
            </div>
          </div>
          <div className={styles.previewMetaGrid}>
            <div className={styles.previewMetaItem}>
              <span>Department</span>
              <strong>Information Technology</strong>
            </div>
            <div className={styles.previewMetaItem}>
              <span>Probation Milestone</span>
              <strong>Passed &bull; Regularized</strong>
            </div>
          </div>
          <div className={styles.previewRecordTimeline}>
            <div className={styles.timelinePoint}>
              <span className={styles.timelineDot} />
              <div>
                <small>Oct 12, 2024</small>
                <p>Regularization confirmed by HR Admin</p>
              </div>
            </div>
            <div className={styles.timelinePoint}>
              <span className={styles.timelineDot} />
              <div>
                <small>Apr 12, 2024</small>
                <p>Onboarded from Candidate Intake</p>
              </div>
            </div>
          </div>
          <div className={styles.previewCardFooter}>
            <span className={styles.previewNote}>Data Scope: Tenant-Isolated</span>
            <span className={styles.previewActionPill}>Active Record</span>
          </div>
        </div>
      ),
    },
    {
      id: 'attendance',
      number: '03',
      title: 'Attendance',
      category: 'Time & Scheduling',
      summary: 'Manage shift schedules, biometric logs, attendance status, punctuality calculation, and formal correction requests.',
      details: [
        'Real-time biometric punch integration and time stamping',
        'Automated tardiness, undertime, and overtime calculation',
        'Audited correction filing and manager approval workflows',
      ],
      uiFragment: (
        <div className={styles.authenticPreviewCard}>
          <div className={styles.previewCardHeader}>
            <div className={styles.previewCardBadge}>
              <Clock3 size={14} />
              <span>Daily Attendance Log</span>
            </div>
            <span className={styles.previewStatusSuccess}>On Time</span>
          </div>
          <div className={styles.previewTimeHero}>
            <div className={styles.punchTimeBlock}>
              <small>Time In</small>
              <strong>08:02 AM</strong>
              <span>Biometric Terminal 01</span>
            </div>
            <div className={styles.punchDivider} />
            <div className={styles.punchTimeBlock}>
              <small>Scheduled Shift</small>
              <strong>08:00 – 17:00</strong>
              <span>Weekday Core Schedule</span>
            </div>
          </div>
          <div className={styles.previewMetaGrid}>
            <div className={styles.previewMetaItem}>
              <span>Grace Period</span>
              <strong>15 mins (Compliant)</strong>
            </div>
            <div className={styles.previewMetaItem}>
              <span>Status Calculation</span>
              <strong className={styles.textSuccess}>Present &bull; Validated</strong>
            </div>
          </div>
          <div className={styles.previewCardFooter}>
            <span className={styles.previewNote}>Sync: Direct to Payroll Cutoff</span>
            <span className={styles.previewActionPill}>Log Verified</span>
          </div>
        </div>
      ),
    },
    {
      id: 'leave',
      number: '04',
      title: 'Leave',
      category: 'Absence Management',
      summary: 'Handle employee leave requests, approval hierarchies, balance tracking, and automatic attendance integration.',
      details: [
        'Dedicated leave balance ledgers (Vacation, Sick, Emergency)',
        'Multi-step routing to HR and department supervisors',
        'Direct synchronization into timecards and schedule calendars',
      ],
      uiFragment: (
        <div className={styles.authenticPreviewCard}>
          <div className={styles.previewCardHeader}>
            <div className={styles.previewCardBadge}>
              <CalendarCheck2 size={14} />
              <span>Leave Application</span>
            </div>
            <span className={styles.previewStatusSuccess}>Approved</span>
          </div>
          <div className={styles.previewLeaveDetails}>
            <div className={styles.leaveTypeHeader}>
              <strong>Vacation Leave &bull; 3 Days</strong>
              <span>Nov 18, 2026 – Nov 20, 2026</span>
            </div>
            <p className={styles.leaveReasonText}>&ldquo;Annual scheduled leave &bull; Handover completed with team lead.&rdquo;</p>
          </div>
          <div className={styles.previewBalanceLedger}>
            <div className={styles.ledgerRow}>
              <span>Beginning Balance</span>
              <strong>15.0 Days</strong>
            </div>
            <div className={styles.ledgerRow}>
              <span>Deduction (This Request)</span>
              <strong className={styles.textMaroon}>- 3.0 Days</strong>
            </div>
            <div className={`${styles.ledgerRow} ${styles.ledgerRowTotal}`}>
              <span>Remaining Available</span>
              <strong className={styles.textSuccess}>12.0 Days</strong>
            </div>
          </div>
          <div className={styles.previewCardFooter}>
            <span className={styles.previewNote}>Calendar: Attendance Updated</span>
            <span className={styles.previewActionPill}>Reviewed by HR</span>
          </div>
        </div>
      ),
    },
    {
      id: 'payroll',
      number: '05',
      title: 'Payroll',
      category: 'Compensation Foundation',
      summary: 'Use verified compensation rates, pay frequencies, and validated workforce attendance as the basis for payroll processing.',
      details: [
        'Effective-dated base salary and compensation records',
        'Configurable pay frequencies (Semimonthly, Monthly)',
        'Attendance-backed cutoffs eliminating manual spreadsheet sync',
      ],
      uiFragment: (
        <div className={styles.authenticPreviewCard}>
          <div className={styles.previewCardHeader}>
            <div className={styles.previewCardBadge}>
              <CreditCard size={14} />
              <span>Compensation Foundation</span>
            </div>
            <span className={styles.previewStatusRegular}>Ready for Cutoff</span>
          </div>
          <div className={styles.previewCompensationHero}>
            <div>
              <small>Effective Base Rate</small>
              <p className={styles.compRateText}>PHP 65,000.00</p>
              <span>Frequency: Semimonthly</span>
            </div>
            <div className={styles.compStatusTag}>Active</div>
          </div>
          <div className={styles.previewMetaGrid}>
            <div className={styles.previewMetaItem}>
              <span>Payroll Period</span>
              <strong>Oct 01 – Oct 15, 2026</strong>
            </div>
            <div className={styles.previewMetaItem}>
              <span>Validated Timesheets</span>
              <strong className={styles.textSuccess}>10 / 10 Days Logged</strong>
            </div>
          </div>
          <div className={styles.previewCardFooter}>
            <span className={styles.previewNote}>Basis: Attendance &amp; Leave Ledger</span>
            <span className={styles.previewActionPill}>Cutoff Enforced</span>
          </div>
        </div>
      ),
    },
    {
      id: 'ess',
      number: '06',
      title: 'Employee Self-Service',
      category: 'Employee Portal',
      summary: 'Give employees direct, role-restricted access to view their attendance, file leave requests, and review personal profiles.',
      details: [
        'Safe employee self-service without access to administrative back-office',
        'Personal attendance history and punch dispute logging',
        'Live leave balances and paperless request filing',
      ],
      uiFragment: (
        <div className={styles.authenticPreviewCard}>
          <div className={styles.previewCardHeader}>
            <div className={styles.previewCardBadge}>
              <UserCheck size={14} />
              <span>Employee Portal View</span>
            </div>
            <span className={styles.previewStatusNeutral}>Authenticated Session</span>
          </div>
          <div className={styles.essNavPills}>
            <span className={styles.essNavPillActive}>My Profile</span>
            <span className={styles.essNavPill}>My Attendance</span>
            <span className={styles.essNavPill}>My Leave</span>
          </div>
          <div className={styles.previewCandidateProfile}>
            <div className={styles.previewCandidateAvatar}>EV</div>
            <div>
              <p className={styles.previewCandidateName}>Elena Vance</p>
              <p className={styles.previewCandidateRole}>Information Technology &bull; Regular</p>
            </div>
          </div>
          <div className={styles.previewMetaGrid}>
            <div className={styles.previewMetaItem}>
              <span>Today&apos;s Status</span>
              <strong className={styles.textSuccess}>Timed In &bull; 08:02 AM</strong>
            </div>
            <div className={styles.previewMetaItem}>
              <span>Available Leave</span>
              <strong>12.0 Vacation Days</strong>
            </div>
          </div>
          <div className={styles.previewCardFooter}>
            <span className={styles.previewNote}>Access: Zero Back-Office Exposure</span>
            <span className={styles.previewActionPill}>Self-Service Safe</span>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.modulesLayout}>
      <div className={styles.modulesNavList} role="tablist" aria-label="WorkPulse product modules">
        {modules.map((m, index) => {
          const isActive = index === activeModule;
          return (
            <button
              key={m.id}
              role="tab"
              id={`module-tab-${m.id}`}
              aria-selected={isActive}
              aria-controls={`module-panel-${m.id}`}
              className={`${styles.moduleNavRow} ${isActive ? styles.moduleNavRowActive : ''}`}
              onClick={() => setActiveModule(index)}
            >
              <div className={styles.moduleNavLeft}>
                <span className={styles.moduleNavNumber}>{m.number}</span>
                <div>
                  <div className={styles.moduleNavHeaderLine}>
                    <h3 className={styles.moduleNavTitle}>{m.title}</h3>
                    <span className={styles.moduleNavCategory}>{m.category}</span>
                  </div>
                  <p className={styles.moduleNavSummary}>{m.summary}</p>
                </div>
              </div>
              <ArrowRight size={16} className={styles.moduleNavArrow} />
            </button>
          );
        })}
      </div>

      <div
        className={styles.moduleInspector}
        role="tabpanel"
        id={`module-panel-${modules[activeModule].id}`}
        aria-labelledby={`module-tab-${modules[activeModule].id}`}
      >
        <div className={styles.inspectorHeader}>
          <div className={styles.inspectorHeadingBlock}>
            <span className={styles.inspectorKicker}>
              Module {modules[activeModule].number} &bull; {modules[activeModule].category}
            </span>
            <h3 className={styles.inspectorTitle}>{modules[activeModule].title}</h3>
          </div>
          <span className={styles.inspectorTag}>Authentic WorkPulse UI</span>
        </div>

        <p className={styles.inspectorSummary}>{modules[activeModule].summary}</p>

        <ul className={styles.inspectorBullets}>
          {modules[activeModule].details.map((detail) => (
            <li key={detail}>
              <Check size={14} className={styles.iconMaroon} />
              <span>{detail}</span>
            </li>
          ))}
        </ul>

        <div className={styles.inspectorPreviewWrap}>
          {modules[activeModule].uiFragment}
        </div>
      </div>
    </div>
  );
}
