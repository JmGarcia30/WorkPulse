import { notFound, redirect } from 'next/navigation';
import { EmploymentCategory, EmployeeStatus, ProbationStatus } from '@prisma/client';
import { getBackOfficeReadContext } from '@/lib/auth/guards';
import { canManageEmploymentLifecycle, canViewEmployees } from '@/lib/permissions/rbac';
import { getOrganizationEmployeeById } from '@/features/employees/queries';
import { deriveProbationReviewState } from '@/features/employees/domain';
import { EmployeeProfileHeader } from '@/components/employees/profile/EmployeeProfileHeader';
import {
  EmployeeProfileTabs,
  type ProfileTabId,
} from '@/components/employees/profile/EmployeeProfileTabs';
import { OverviewTab } from '@/components/employees/profile/OverviewTab';
import { ProbationTab } from '@/components/employees/profile/ProbationTab';
import { EmploymentHistoryTab } from '@/components/employees/profile/EmploymentHistoryTab';
import { DecisionsAuditTab } from '@/components/employees/profile/DecisionsAuditTab';
import { ComplianceTab } from '@/components/employees/profile/ComplianceTab';
import { EssAccountTab } from '@/components/employees/profile/EssAccountTab';

interface EmployeeProfilePageProps {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<{ tab?: string }>;
}

const date = (value: Date | null | undefined) =>
  value
    ? new Intl.DateTimeFormat('en-PH', { timeZone: 'UTC', dateStyle: 'medium' }).format(value)
    : '—';
const dateInput = (value: Date | null | undefined) =>
  value ? value.toISOString().slice(0, 10) : '';
const label = (value: string) => value.replaceAll('_', ' ');

export default async function EmployeeProfilePage({
  params,
  searchParams,
}: EmployeeProfilePageProps) {
  let user;
  try {
    user = await getBackOfficeReadContext();
  } catch (error) {
    if (error instanceof Error && ['UNAUTHENTICATED', 'FORBIDDEN'].includes(error.message)) redirect('/login');
    throw error;
  }
  if (!canViewEmployees(user)) redirect('/dashboard');

  const { employeeId } = await params;
  const { tab: rawTab } = await searchParams;

  const validTabs: ProfileTabId[] = [
    'overview',
    'probation',
    'history',
    'decisions',
    'compliance',
    'account',
  ];
  const activeTab: ProfileTabId = validTabs.includes(rawTab as ProfileTabId)
    ? (rawTab as ProfileTabId)
    : 'overview';

  const employee = await getOrganizationEmployeeById(user.organizationId, employeeId, activeTab);
  if (!employee) notFound();

  const now = new Date();
  const activeEmployment = employee.employmentRecords.find(
    (record) =>
      record.effectiveFrom <= now && (record.effectiveTo === null || record.effectiveTo > now)
  );
  const shown = activeEmployment ?? employee.employmentRecords[0];
  if (!shown) notFound();

  const isHistoricalOnly = !activeEmployment;
  const probation = shown.probation ?? null;
  const review = probation
    ? deriveProbationReviewState({
        probationStatus: probation.probationStatus,
        expectedEndAt: probation.expectedEndAt,
        asOf: now,
      })
    : null;

  const offer = employee.employmentRecords.find((record) => record.acceptedOffer)?.acceptedOffer;
  const onboarding = employee.sourceApplication.onboarding;
  const requiredTasks = onboarding?.tasks.filter((task) => task.isRequired) ?? [];
  const satisfiedTasks = requiredTasks.filter(
    (task) => task.status === 'VERIFIED' || task.status === 'WAIVED'
  );

  const decisionAllowed =
    canManageEmploymentLifecycle(user) &&
    employee.employeeStatus === EmployeeStatus.ACTIVE &&
    probation?.probationStatus === ProbationStatus.ACTIVE &&
    review?.decisionAllowed === true;

  const regularizationAllowed =
    decisionAllowed && shown.employmentCategory === EmploymentCategory.NON_TEACHING;
  const renewalAllowed =
    decisionAllowed &&
    shown.employmentCategory === EmploymentCategory.TEACHING &&
    probation !== null &&
    probation.renewalCount < probation.maxRenewals;
  const notRenewalAllowed = decisionAllowed;

  let blockedReason: string | null = null;
  if (!canManageEmploymentLifecycle(user)) {
    blockedReason = 'Your role cannot record employment lifecycle decisions.';
  } else if (employee.employeeStatus !== EmployeeStatus.ACTIVE) {
    blockedReason = 'This employee has no active employment relationship.';
  } else if (!probation || probation.probationStatus !== ProbationStatus.ACTIVE) {
    blockedReason = 'There is no active probation period awaiting a decision.';
  } else if (!review?.decisionAllowed) {
    blockedReason = `Final actions become available on ${date(probation.expectedEndAt)}. Current state: ${label(review?.state ?? 'ACTIVE')}.`;
  } else if (
    shown.employmentCategory === EmploymentCategory.TEACHING &&
    probation.renewalCount >= probation.maxRenewals
  ) {
    blockedReason =
      'The maximum Teaching renewals have been reached. H2 defines no Faculty regularization action.';
  }

  return (
    <div className="space-y-6">
      {/* 1. Header with Identity & Back Action */}
      <EmployeeProfileHeader
        employee={employee}
        currentRecord={shown}
        isHistoricalOnly={isHistoricalOnly}
      />

      {/* 2. URL-based Tab Navigation Bar */}
      <EmployeeProfileTabs
        employeeId={employee.id}
        activeTab={activeTab}
        badges={{
          probationNeedsAttention: review?.needsAttention ?? false,
          historyCount: employee.employmentRecords.length,
          decisionsCount: employee._count.employmentDecisions + employee._count.statusHistory,
          complianceTasksTotal: requiredTasks.length,
          complianceTasksSatisfied: satisfiedTasks.length,
        }}
      />

      {/* 3. Active Tab Content Panels */}
      <div className="pt-1">
        {activeTab === 'overview' && (
          <OverviewTab
            employeeId={employee.id}
            sourceApplicationId={employee.sourceApplicationId}
            currentRecord={shown}
            probationReview={review}
            probationExpectedEndAt={probation?.expectedEndAt ?? null}
            isHistoricalOnly={isHistoricalOnly}
          />
        )}

        {activeTab === 'probation' && (
          <ProbationTab
            employeeId={employee.id}
            employeeName={`${employee.firstName} ${employee.lastName}`}
            category={shown.employmentCategory}
            probation={probation}
            review={review}
            probationHistory={employee.probationRecords}
            regularizationAllowed={regularizationAllowed}
            renewalAllowed={renewalAllowed}
            notRenewalAllowed={notRenewalAllowed}
            blockedReason={blockedReason}
            defaultEffectiveDate={dateInput(probation?.expectedEndAt)}
          />
        )}

        {activeTab === 'history' && (
          <EmploymentHistoryTab employmentRecords={employee.employmentRecords} />
        )}

        {activeTab === 'decisions' && (
          <DecisionsAuditTab
            employmentDecisions={employee.employmentDecisions}
            statusHistory={employee.statusHistory}
          />
        )}

        {activeTab === 'compliance' && (
          <ComplianceTab
            sourceApplicationId={employee.sourceApplicationId}
            offer={offer ?? null}
            onboarding={onboarding ?? null}
          />
        )}

        {activeTab === 'account' && (
          <EssAccountTab
            employeeId={employee.id}
            contactEmail={employee.email}
            employeeActive={employee.employeeStatus === EmployeeStatus.ACTIVE}
            account={
              employee.employeeAccount
                ? {
                    id: employee.employeeAccount.id,
                    email: employee.employeeAccount.user.email,
                    status: employee.employeeAccount.status,
                    expiresAt:
                      employee.employeeAccount.activationTokenExpiresAt?.toISOString() ?? null,
                    activatedAt: employee.employeeAccount.activatedAt?.toISOString() ?? null,
                    disabledAt: employee.employeeAccount.disabledAt?.toISOString() ?? null,
                    disabledReason: employee.employeeAccount.disabledReason,
                  }
                : null
            }
            audits={employee.employeeAccount?.audits ?? []}
          />
        )}
      </div>
    </div>
  );
}
