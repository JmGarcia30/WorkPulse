import { EmploymentStatus, LeaveCountingMode, LeaveOccurrenceScope, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { LeaveError } from './domain';

const MANUAL = 'SAGA Administration Manual — Leave Benefits';

export const SAGA_LEAVE_TYPES = [
  {
    code: 'SICK_PERSONAL', name: 'Sick / Personal Leave', description: 'One combined five-day annual entitlement pool.',
    isPaid: true, countingMode: LeaveCountingMode.SCHEDULED_WORK_DAYS, balanceTracked: true, defaultGrantUnits: new Prisma.Decimal(5),
    requiredEmploymentStatus: EmploymentStatus.REGULAR, minimumServiceMonths: null, maximumRequestUnits: new Prisma.Decimal(5),
    maximumApprovedOccurrences: null, occurrenceLimitScope: null, allowsRetrospectiveFiling: true, requiresEligibilityVerification: false,
    requestCategoryOptions: [{ code: 'SICK', label: 'Sick' }, { code: 'PERSONAL', label: 'Personal' }],
    attestationRules: [],
    documentRules: [{ categoryCode: 'SICK', minimumUnits: 2, kindCode: 'MEDICAL_CERTIFICATE', label: 'Medical certificate', satisfaction: 'DOCUMENT_REQUIRED' }],
    policyReference: `${MANUAL}. Five combined days per calendar year for regular employees. Sick Leave Form goes to Finance Office upon return. Sick leave of two days or more requires a medical certificate. Cash conversion is outside H5. Scheduled-day counting is provisional pending SAGA HR confirmation.`,
  },
  {
    code: 'MATERNITY', name: 'Maternity Leave', description: 'SSS-governed maternity leave of up to 105 calendar days.',
    isPaid: true, countingMode: LeaveCountingMode.CALENDAR_DAYS, balanceTracked: false, defaultGrantUnits: null,
    requiredEmploymentStatus: null, minimumServiceMonths: 6, maximumRequestUnits: new Prisma.Decimal(105), maximumApprovedOccurrences: null, occurrenceLimitScope: null,
    allowsRetrospectiveFiling: false, requiresEligibilityVerification: true, requestCategoryOptions: [],
    attestationRules: [{ code: 'FEMALE_ELIGIBILITY', label: 'I attest that I meet the policy eligibility requirement.', required: true }, { code: 'FULL_TIME_STATUS', label: 'I attest that I am a full-time employee.', required: true }, { code: 'EXPECTED_DELIVERY_DATE', label: 'Expected delivery date (YYYY-MM-DD)', required: true }],
    documentRules: [{ kindCode: 'SSS_SUPPORT', label: 'SSS approval/supporting documentation', satisfaction: 'DOCUMENT_OR_HR_VERIFICATION' }],
    policyReference: `${MANUAL}. Female full-time employee; six months continuous service immediately before expected delivery; up to 105 days; SSS approval/support required. No payment computation in H5.`,
  },
  {
    code: 'PATERNITY', name: 'Paternity Leave', description: 'Seven scheduled working days for qualifying childbirth deliveries.',
    isPaid: true, countingMode: LeaveCountingMode.SCHEDULED_WORK_DAYS, balanceTracked: false, defaultGrantUnits: null,
    requiredEmploymentStatus: null, minimumServiceMonths: null, maximumRequestUnits: new Prisma.Decimal(7), maximumApprovedOccurrences: 4, occurrenceLimitScope: LeaveOccurrenceScope.LIFETIME,
    allowsRetrospectiveFiling: false, requiresEligibilityVerification: true, requestCategoryOptions: [],
    attestationRules: [{ code: 'FULL_TIME_STATUS', label: 'I attest that I am a full-time employee.', required: true }, { code: 'LEGAL_SPOUSE_DELIVERY', label: 'I attest that this request concerns my legal spouse giving birth.', required: true }, { code: 'DELIVERY_SEQUENCE', label: 'Delivery number covered by the policy (1-4)', required: true, options: ['1', '2', '3', '4'] }],
    documentRules: [], policyReference: `${MANUAL}. Seven working days for a full-time male employee when the legal spouse gives birth; limited to four deliveries.`,
  },
  {
    code: 'SOLO_PARENT', name: 'Solo Parent Leave', description: 'Seven scheduled working days per calendar year.',
    isPaid: true, countingMode: LeaveCountingMode.SCHEDULED_WORK_DAYS, balanceTracked: true, defaultGrantUnits: new Prisma.Decimal(7),
    requiredEmploymentStatus: null, minimumServiceMonths: 12, maximumRequestUnits: new Prisma.Decimal(7), maximumApprovedOccurrences: null, occurrenceLimitScope: null,
    allowsRetrospectiveFiling: false, requiresEligibilityVerification: true, requestCategoryOptions: [],
    attestationRules: [{ code: 'FULL_TIME_STATUS', label: 'I attest that I am a full-time employee.', required: true }, { code: 'SOLO_PARENT_STATUS', label: 'I attest that I hold qualifying Solo Parent status.', required: true }],
    documentRules: [], policyReference: `${MANUAL}. Full-time Solo Parent employees with one year of service receive seven working days per year.`,
  },
  {
    code: 'BEREAVEMENT', name: 'Bereavement Leave', description: 'Three paid days for death of an immediate family member.',
    isPaid: true, countingMode: LeaveCountingMode.SCHEDULED_WORK_DAYS, balanceTracked: false, defaultGrantUnits: null,
    requiredEmploymentStatus: null, minimumServiceMonths: null, maximumRequestUnits: new Prisma.Decimal(3), maximumApprovedOccurrences: null, occurrenceLimitScope: null,
    allowsRetrospectiveFiling: true, requiresEligibilityVerification: true,
    requestCategoryOptions: [{ code: 'SPOUSE', label: 'Spouse' }, { code: 'CHILD', label: 'Child' }, { code: 'PARENT', label: 'Parent' }, { code: 'BROTHER', label: 'Brother' }, { code: 'SISTER', label: 'Sister' }],
    attestationRules: [{ code: 'FULL_TIME_STATUS', label: 'I attest that I am a full-time employee.', required: true }], documentRules: [],
    policyReference: `${MANUAL}. Three paid days for spouse, children, parents, brother, or sister. Scheduled-day counting is provisional pending SAGA HR confirmation.`,
  },
  {
    code: 'STUDY', name: 'Study Leave', description: 'Unpaid study leave for explicitly verified tenured employees.',
    isPaid: false, countingMode: LeaveCountingMode.CALENDAR_DAYS, balanceTracked: false, defaultGrantUnits: null,
    requiredEmploymentStatus: null, minimumServiceMonths: 120, maximumRequestUnits: new Prisma.Decimal(732), maximumApprovedOccurrences: null, occurrenceLimitScope: null,
    allowsRetrospectiveFiling: false, requiresEligibilityVerification: true, requestCategoryOptions: [],
    attestationRules: [{ code: 'TENURED_STATUS', label: 'I attest that I hold tenured status subject to HR verification.', required: true }], documentRules: [],
    policyReference: `${MANUAL}. Tenured employee with at least ten years of service; unpaid; maximum two years. REGULAR status is not treated as proof of tenure.`,
  },
] as const;

export async function configureSagaLeavePolicy(input: { organizationId: string; actorUserId: string; year: number }) {
  const actor = await prisma.user.findFirst({ where: { id: input.actorUserId, organizationId: input.organizationId, role: { in: ['ORGANIZATION_ADMIN', 'HR_ADMIN'] } } });
  if (!actor) throw new LeaveError('FORBIDDEN', 'Unauthorized to configure SAGA leave policy.');
  const organization = await prisma.organization.findUnique({ where: { id: input.organizationId } });
  if (!organization || organization.slug !== 'st-aloysius') throw new LeaveError('NOT_SAGA', 'The SAGA policy can only be applied to the SAGA organization.');
  return prisma.$transaction(async (tx) => {
    const configured = [];
    for (const definition of SAGA_LEAVE_TYPES) {
      const type = await tx.leaveType.upsert({ where: { organizationId_code: { organizationId: input.organizationId, code: definition.code } }, update: { ...definition }, create: { organizationId: input.organizationId, ...definition } });
      if (type.balanceTracked) {
        await tx.leaveCycle.upsert({ where: { organizationId_leaveTypeId_code: { organizationId: input.organizationId, leaveTypeId: type.id, code: String(input.year) } }, update: { name: `${input.year} Calendar Year`, startDate: new Date(`${input.year}-01-01T00:00:00Z`), endDate: new Date(`${input.year}-12-31T00:00:00Z`) }, create: { organizationId: input.organizationId, leaveTypeId: type.id, code: String(input.year), name: `${input.year} Calendar Year`, startDate: new Date(`${input.year}-01-01T00:00:00Z`), endDate: new Date(`${input.year}-12-31T00:00:00Z`) } });
      }
      configured.push(type.code);
    }
    return configured;
  });
}
