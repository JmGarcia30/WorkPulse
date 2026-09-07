import { readFile } from 'node:fs/promises';
import { prisma } from '../src/lib/db/prisma';
import { ApplicationStatus, EmploymentCategory, Role } from '@prisma/client';
import {
  convertApplicationToEmployee,
  EmployeeConversionError,
} from '../src/features/employees/conversion';
import { calculateHiringPrerequisites } from '../src/features/hiring/readiness';

interface TeachingDateMap {
  [applicationId: string]: string;
}

async function loadTeachingDates(): Promise<TeachingDateMap> {
  const flagIndex = process.argv.indexOf('--teaching-dates');
  if (flagIndex === -1 || !process.argv[flagIndex + 1]) return {};
  return JSON.parse(await readFile(process.argv[flagIndex + 1], 'utf8')) as TeachingDateMap;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const teachingDates = await loadTeachingDates();
  const applications = await prisma.application.findMany({
    where: { status: ApplicationStatus.HIRED, employee: null },
    include: {
      job: { include: { organization: true } },
      applicant: true,
      offers: true,
      assessments: true,
      interviews: { include: { evaluation: true } },
      recruitmentDocuments: true,
      onboarding: { include: { tasks: true } },
    },
    orderBy: { appliedAt: 'asc' },
  });

  console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${applications.length} legacy HIRED Application(s) require review.`);

  let converted = 0;
  let skipped = 0;
  for (const application of applications) {
    const label = `${application.applicant.firstName} ${application.applicant.lastName} (${application.id})`;
    const acceptedOffers = application.offers.filter((offer) => offer.status === 'ACCEPTED');
    if (acceptedOffers.length !== 1) {
      console.log(`SKIP ${label}: expected exactly one accepted Offer, found ${acceptedOffers.length}.`);
      skipped += 1;
      continue;
    }

    const readiness = calculateHiringPrerequisites({
      id: application.id,
      status: application.status,
      appliedAt: application.appliedAt,
      jobCategory: application.job.category,
      applicant: application.applicant,
      recruitmentDocuments: application.recruitmentDocuments,
      assessments: application.assessments,
      interviews: application.interviews.map((interview) => ({
        id: interview.id,
        type: interview.type,
        status: interview.status,
        evaluationNotes: interview.evaluation?.comments,
        recommendation: interview.evaluation?.recommendation,
        overallScore: interview.evaluation?.overallScore,
      })),
      offers: application.offers,
      onboarding: application.onboarding,
    });
    if (!readiness.isReadyToHire) {
      console.log(`SKIP ${label}: ${readiness.unmetRequirements.join(' ')}`);
      skipped += 1;
      continue;
    }

    const teachingDateValue = teachingDates[application.id];
    if (application.job.category === EmploymentCategory.TEACHING && !teachingDateValue) {
      console.log(`SKIP ${label}: exact Teaching school-year end date is required.`);
      skipped += 1;
      continue;
    }

    const actor = await prisma.user.findFirst({
      where: {
        organizationId: application.job.organizationId,
        role: { in: [Role.ORGANIZATION_ADMIN, Role.HR_ADMIN] },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!actor) {
      console.log(`SKIP ${label}: organization has no Admin/HR actor for audit history.`);
      skipped += 1;
      continue;
    }

    if (!apply) {
      console.log(`READY ${label}: would allocate an Employee record.`);
      continue;
    }

    try {
      const result = await convertApplicationToEmployee({
        applicationId: application.id,
        organizationId: application.job.organizationId,
        actorUserId: actor.id,
        teachingExpectedEndAt: teachingDateValue
          ? new Date(`${teachingDateValue}T00:00:00.000Z`)
          : null,
      });
      console.log(`CONVERTED ${label}: ${result.employeeNumber}`);
      converted += 1;
    } catch (error) {
      const reason =
        error instanceof EmployeeConversionError || error instanceof Error
          ? error.message
          : String(error);
      console.log(`SKIP ${label}: ${reason}`);
      skipped += 1;
    }
  }

  console.log(`Completed: converted=${converted}, skipped=${skipped}, dryRun=${!apply}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
