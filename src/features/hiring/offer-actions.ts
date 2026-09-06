'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { getSession } from '@/lib/auth/session';
import { canManageOffers, canApproveOffer } from '@/lib/permissions/rbac';
import { OfferStatus, PayFrequency, OnboardingStatus, OnboardingTaskStatus } from '@prisma/client';
import {
  ACTIVE_OFFER_STATUSES,
  isValidOfferTransition,
} from './offer-pipeline';
import { createSagaOnboardingProcessInTx } from './onboarding-actions';

export interface CreateOfferInput {
  applicationId: string;
  salary: number;
  payFrequency?: PayFrequency;
  employmentType: string;
  startDate: string; // ISO date string
  expirationDate?: string; // ISO date string
  benefits?: string;
  allowances?: string;
  additionalTerms?: string;
  notes?: string;
  status?: OfferStatus;
}

export interface UpdateOfferInput {
  salary?: number;
  payFrequency?: PayFrequency;
  employmentType?: string;
  startDate?: string;
  expirationDate?: string;
  benefits?: string;
  allowances?: string;
  additionalTerms?: string;
  notes?: string;
}

/**
 * Create a new employment offer for an application.
 * Enforces multi-tenant derivation and single active offer business rule.
 */
export async function createOfferAction(input: CreateOfferInput) {
  const user = await getSession();
  if (!user || !canManageOffers(user)) {
    return { error: 'Unauthorized to create employment offers.' };
  }

  const {
    applicationId,
    salary,
    payFrequency = PayFrequency.MONTHLY,
    employmentType,
    startDate,
    expirationDate,
    benefits,
    allowances,
    additionalTerms,
    notes,
    status = OfferStatus.DRAFT,
  } = input;

  if (!applicationId || !employmentType?.trim() || !startDate) {
    return { error: 'Application, employment type, and start date are required.' };
  }

  // Validate salary
  const numSalary = Number(salary);
  if (isNaN(numSalary) || numSalary <= 0) {
    return { error: 'Salary / base compensation must be greater than 0.' };
  }

  // Validate pay frequency
  if (!Object.values(PayFrequency).includes(payFrequency)) {
    return { error: 'Invalid pay frequency provided.' };
  }

  // Validate start date
  const startDateTime = new Date(startDate);
  if (isNaN(startDateTime.getTime())) {
    return { error: 'Invalid start date provided.' };
  }

  // Validate expiration date if provided
  let expirationDateTime: Date | null = null;
  if (expirationDate) {
    expirationDateTime = new Date(expirationDate);
    if (isNaN(expirationDateTime.getTime())) {
      return { error: 'Invalid expiration date provided.' };
    }
    if (expirationDateTime <= startDateTime) {
      return { error: 'Offer expiration date must be after the start date.' };
    }
  }

  // Derived Multi-tenant Check: Verify Application belongs to User's Organization
  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      job: {
        organizationId: user.organizationId,
      },
    },
    include: {
      job: true,
      interviews: {
        include: { evaluation: true },
      },
    },
  });

  if (!application) {
    return { error: 'Application not found or access denied.' };
  }

  // SAGA Gating: President final interview must not be failed
  const presidentInterview = application.interviews.find(
    (i) => i.type === 'PRESIDENT_FINAL'
  );
  if (
    presidentInterview &&
    presidentInterview.evaluation?.recommendation === 'DO_NOT_RECOMMEND'
  ) {
    return {
      error:
        'Cannot issue an Employment Contract: President Final Interview outcome was not approved.',
    };
  }

  // Active Offer Duplicate Check: Enforce that only one active offer may exist per application
  const existingActiveOffer = await prisma.offer.findFirst({
    where: {
      applicationId,
      status: {
        in: ACTIVE_OFFER_STATUSES,
      },
    },
  });

  if (existingActiveOffer) {
    return {
      error: `An active offer in ${existingActiveOffer.status} status already exists for this candidate. Please resolve or withdraw it before creating a new offer.`,
    };
  }

  const initialStatus =
    status === OfferStatus.PENDING_APPROVAL
      ? OfferStatus.PENDING_APPROVAL
      : OfferStatus.DRAFT;

  const isTeaching = application.job.category === 'TEACHING';
  const defaultProbationMonths = isTeaching ? 12 : 6;
  const defaultProbationTerms = isTeaching
    ? 'Probationary appointment for one (1) school year, renewable annually for a maximum of three (3) school years.'
    : 'Probationary appointment for six (6) months; satisfactory completion may result in regular appointment.';

  const offer = await prisma.offer.create({
    data: {
      applicationId,
      salary: numSalary,
      payFrequency,
      employmentType: employmentType.trim(),
      startDate: startDateTime,
      expirationDate: expirationDateTime,
      benefits: benefits?.trim() || null,
      allowances: allowances?.trim() || null,
      additionalTerms: additionalTerms?.trim() || null,
      notes: notes?.trim() || null,
      status: initialStatus,
      probationPeriodMonths: defaultProbationMonths,
      probationaryTerms: defaultProbationTerms,
      createdById: user.userId,
    },
  });

  revalidatePath('/dashboard/hiring/offers');
  revalidatePath('/dashboard/hiring/applicants');
  revalidatePath(`/dashboard/hiring/applicants/${applicationId}`);
  revalidatePath('/dashboard');

  return { success: true, offerId: offer.id };
}

/**
 * Transition offer status according to centralized transition rules.
 */
export async function updateOfferStatusAction(
  offerId: string,
  newStatus: OfferStatus,
  actionNotes?: string
) {
  const user = await getSession();
  if (!user || !canManageOffers(user)) {
    return { error: 'Unauthorized to modify offer status.' };
  }

  if (!Object.values(OfferStatus).includes(newStatus)) {
    return { error: 'Invalid offer status provided.' };
  }

  // If approving, verify approver role permission
  if (newStatus === OfferStatus.APPROVED && !canApproveOffer(user)) {
    return { error: 'Unauthorized to approve employment offers.' };
  }

  // Derive tenant: Offer -> Application -> Job -> Organization
  const offer = await prisma.offer.findFirst({
    where: {
      id: offerId,
      application: {
        job: {
          organizationId: user.organizationId,
        },
      },
    },
    include: {
      application: {
        include: {
          job: true,
          recruitmentDocuments: true,
        },
      },
    },
  });

  if (!offer) {
    return { error: 'Offer not found or access denied.' };
  }

  if (!isValidOfferTransition(offer.status, newStatus)) {
    return {
      error: `Invalid offer transition from ${offer.status} to ${newStatus}.`,
    };
  }

  const updateData: {
    status: OfferStatus;
    approvedById?: string | null;
    notes?: string | null;
  } = {
    status: newStatus,
  };

  if (newStatus === OfferStatus.APPROVED) {
    updateData.approvedById = user.userId;
  }

  if (actionNotes && actionNotes.trim()) {
    updateData.notes = offer.notes
      ? `${offer.notes}\n[${newStatus} on ${new Date().toLocaleDateString()}]: ${actionNotes.trim()}`
      : `[${newStatus} on ${new Date().toLocaleDateString()}]: ${actionNotes.trim()}`;
  }

  await prisma.$transaction(async (tx) => {
    await tx.offer.update({
      where: { id: offerId },
      data: updateData,
    });

    // When an offer is marked ACCEPTED, initialize pre-employment onboarding checklist if not yet present
    if (newStatus === OfferStatus.ACCEPTED) {
      const existingProcess = await tx.onboardingProcess.findUnique({
        where: { applicationId: offer.applicationId },
      });

      if (!existingProcess) {
        const startDate = offer.startDate || new Date();
        await createSagaOnboardingProcessInTx(
          tx,
          offer.application,
          offer,
          startDate,
          `Pre-employment onboarding initialized automatically upon offer acceptance (${offer.employmentType}).`
        );
      }
    }
  });

  revalidatePath('/dashboard/hiring/offers');
  revalidatePath('/dashboard/hiring/onboarding');
  revalidatePath(`/dashboard/hiring/applicants/${offer.applicationId}`);
  revalidatePath('/dashboard');

  return { success: true };
}

/**
 * Edit offer terms before approval / sending.
 */
export async function updateOfferDetailsAction(
  offerId: string,
  input: UpdateOfferInput
) {
  const user = await getSession();
  if (!user || !canManageOffers(user)) {
    return { error: 'Unauthorized to update offer details.' };
  }

  // Derive tenant: Offer -> Application -> Job -> Organization
  const offer = await prisma.offer.findFirst({
    where: {
      id: offerId,
      application: {
        job: {
          organizationId: user.organizationId,
        },
      },
    },
    include: {
      application: true,
    },
  });

  if (!offer) {
    return { error: 'Offer not found or access denied.' };
  }

  // Allow modifications only in DRAFT or PENDING_APPROVAL status
  if (
    offer.status !== OfferStatus.DRAFT &&
    offer.status !== OfferStatus.PENDING_APPROVAL
  ) {
    return {
      error: `Cannot modify offer details while in ${offer.status} status. Only Draft or Pending Approval offers may be edited.`,
    };
  }

  const updateData: {
    salary?: number;
    payFrequency?: PayFrequency;
    employmentType?: string;
    startDate?: Date;
    expirationDate?: Date | null;
    benefits?: string | null;
    allowances?: string | null;
    additionalTerms?: string | null;
    notes?: string | null;
  } = {};

  if (input.salary !== undefined) {
    const numSalary = Number(input.salary);
    if (isNaN(numSalary) || numSalary <= 0) {
      return { error: 'Salary must be greater than 0.' };
    }
    updateData.salary = numSalary;
  }

  if (input.payFrequency) {
    if (!Object.values(PayFrequency).includes(input.payFrequency)) {
      return { error: 'Invalid pay frequency.' };
    }
    updateData.payFrequency = input.payFrequency;
  }

  if (input.employmentType !== undefined) {
    if (!input.employmentType.trim()) {
      return { error: 'Employment type cannot be empty.' };
    }
    updateData.employmentType = input.employmentType.trim();
  }

  let effectiveStartDate = offer.startDate;
  if (input.startDate) {
    const sDate = new Date(input.startDate);
    if (isNaN(sDate.getTime())) {
      return { error: 'Invalid start date.' };
    }
    effectiveStartDate = sDate;
    updateData.startDate = sDate;
  }

  if (input.expirationDate !== undefined) {
    if (input.expirationDate) {
      const expDate = new Date(input.expirationDate);
      if (isNaN(expDate.getTime())) {
        return { error: 'Invalid expiration date.' };
      }
      if (expDate <= effectiveStartDate) {
        return { error: 'Expiration date must be after the start date.' };
      }
      updateData.expirationDate = expDate;
    } else {
      updateData.expirationDate = null;
    }
  }

  if (input.benefits !== undefined) {
    updateData.benefits = input.benefits.trim() || null;
  }
  if (input.allowances !== undefined) {
    updateData.allowances = input.allowances.trim() || null;
  }
  if (input.additionalTerms !== undefined) {
    updateData.additionalTerms = input.additionalTerms.trim() || null;
  }
  if (input.notes !== undefined) {
    updateData.notes = input.notes.trim() || null;
  }

  await prisma.offer.update({
    where: { id: offerId },
    data: updateData,
  });

  revalidatePath('/dashboard/hiring/offers');
  revalidatePath(`/dashboard/hiring/applicants/${offer.applicationId}`);
  revalidatePath('/dashboard');

  return { success: true };
}

/**
 * Record institutional contract execution by the Employee and the President.
 */
export async function executeContractAction(
  offerId: string,
  options: {
    signedByPresident: boolean;
    signedByEmployee: boolean;
  }
) {
  const user = await getSession();
  if (!user || !canManageOffers(user)) {
    return { error: 'Unauthorized to record contract execution.' };
  }

  const offer = await prisma.offer.findFirst({
    where: {
      id: offerId,
      application: {
        job: { organizationId: user.organizationId },
      },
    },
  });

  if (!offer) {
    return { error: 'Offer not found or access denied.' };
  }

  const bothSigned = options.signedByPresident && options.signedByEmployee;

  await prisma.offer.update({
    where: { id: offerId },
    data: {
      contractSignedByPresident: options.signedByPresident,
      contractSignedByEmployee: options.signedByEmployee,
      contractExecutedAt: bothSigned ? new Date() : null,
      status: bothSigned ? OfferStatus.ACCEPTED : offer.status,
    },
  });

  revalidatePath('/dashboard/hiring/offers');
  revalidatePath(`/dashboard/hiring/applicants/${offer.applicationId}`);
  revalidatePath('/dashboard');

  return { success: true };
}
