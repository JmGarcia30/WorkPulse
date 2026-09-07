import { prisma } from '../src/lib/db/prisma';
import {
  ApplicationStatus,
  AssessmentStatus,
  AssessmentType,
  EmploymentCategory,
  EvaluationRecommendation,
  InterviewStatus,
  InterviewType,
  JobStatus,
  OfferStatus,
  OnboardingStatus,
  OnboardingTaskStatus,
  OnboardingTaskType,
  PayFrequency,
  RecruitmentDocumentStatus,
  Role,
} from '@prisma/client';
import { getSagaDocumentRequirements } from '../src/features/hiring/saga-requirements';
import {
  convertApplicationToEmployee,
  EmployeeConversionError,
} from '../src/features/employees/conversion';
import {
  addCalendarMonthsClamped,
  resolveInitialProbationTerms,
} from '../src/features/employees/domain';
import { getOrganizationEmployeeById } from '../src/features/employees/queries';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function createReadyApplication(input: {
  organizationId: string;
  actorUserId: string;
  category: EmploymentCategory;
  email: string;
  firstName: string;
  jobSuffix: string;
  startDate: Date;
}) {
  const job = await prisma.job.create({
    data: {
      organizationId: input.organizationId,
      title: `${input.category === EmploymentCategory.TEACHING ? 'Teacher' : 'Coordinator'} ${input.jobSuffix}`,
      slug: `h1-${input.jobSuffix}`,
      department: input.category === EmploymentCategory.TEACHING ? 'Academics' : 'Administration',
      employmentType: 'Full-Time',
      location: 'Campus',
      description: 'H1 integration fixture',
      responsibilities: 'H1 integration fixture',
      qualifications: 'H1 integration fixture',
      requirements: 'H1 integration fixture',
      category: input.category,
      status: JobStatus.CLOSED,
    },
  });
  const applicant = await prisma.applicant.create({
    data: {
      firstName: input.firstName,
      lastName: 'H1 Test',
      email: input.email,
      phone: '09170000000',
    },
  });
  const application = await prisma.application.create({
    data: {
      jobId: job.id,
      applicantId: applicant.id,
      status: ApplicationStatus.OFFER,
      coverLetter: 'Complete H1 test Application',
    },
  });

  await prisma.recruitmentDocument.createMany({
    data: getSagaDocumentRequirements(input.category).map((requirement) => ({
      applicationId: application.id,
      type: requirement.type,
      title: requirement.title,
      status: RecruitmentDocumentStatus.VERIFIED,
      isRequired: requirement.isRequired,
      isConditional: requirement.isConditional,
      verifiedAt: new Date(),
      verifiedById: input.actorUserId,
    })),
  });
  await prisma.assessment.create({
    data: {
      applicationId: application.id,
      title: 'Written Examination',
      type: AssessmentType.WRITTEN_EXAMINATION,
      status: AssessmentStatus.PASSED,
      score: 90,
      maxScore: 100,
      passingScore: 75,
      evaluatorId: input.actorUserId,
      evaluatedAt: new Date(),
    },
  });

  const interviewTypes = [
    ...(input.category === EmploymentCategory.TEACHING
      ? [InterviewType.TEACHING_DEMONSTRATION]
      : []),
    InterviewType.HEAD_OF_DEPARTMENT,
    InterviewType.PRESIDENT_FINAL,
  ];
  for (const type of interviewTypes) {
    await prisma.interview.create({
      data: {
        applicationId: application.id,
        interviewerId: input.actorUserId,
        scheduledAt: new Date(),
        type,
        status: InterviewStatus.COMPLETED,
        evaluation: {
          create: {
            communicationScore: 5,
            technicalScore: 5,
            problemSolvingScore: 5,
            experienceScore: 5,
            cultureFitScore: 5,
            overallScore: 5,
            recommendation: EvaluationRecommendation.RECOMMEND,
            comments: 'Qualified H1 test candidate',
            evaluatedById: input.actorUserId,
          },
        },
      },
    });
  }

  await prisma.offer.create({
    data: {
      applicationId: application.id,
      salary: input.category === EmploymentCategory.TEACHING ? 42000 : 36000,
      payFrequency: PayFrequency.MONTHLY,
      employmentType: 'Full-Time',
      startDate: input.startDate,
      status: OfferStatus.ACCEPTED,
      contractSignedByPresident: true,
      contractSignedByEmployee: true,
      contractExecutedAt: new Date(),
      probationPeriodMonths: input.category === EmploymentCategory.TEACHING ? 12 : 6,
      probationaryTerms:
        input.category === EmploymentCategory.TEACHING
          ? 'One school year; exact dates stated in the contract.'
          : 'Six calendar months.',
      createdById: input.actorUserId,
      approvedById: input.actorUserId,
    },
  });
  await prisma.onboardingProcess.create({
    data: {
      applicationId: application.id,
      status: OnboardingStatus.COMPLETED,
      startDate: input.startDate,
      completedAt: new Date(),
      tasks: {
        create: {
          title: 'Institutional Orientation',
          type: OnboardingTaskType.ORIENTATION,
          status: OnboardingTaskStatus.VERIFIED,
          isRequired: true,
          verifiedAt: new Date(),
          verifiedById: input.actorUserId,
        },
      },
    },
  });

  return { application, applicant, job };
}

async function main() {
  const staleOrganizations = await prisma.organization.findMany({
    where: { name: 'H1 Employee Core Test Organization' },
    include: {
      jobs: { include: { applications: { select: { applicantId: true } } } },
    },
  });
  for (const stale of staleOrganizations) {
    const staleApplicantIds = stale.jobs.flatMap((job) =>
      job.applications.map((application) => application.applicantId)
    );
    await prisma.employee.deleteMany({ where: { organizationId: stale.id } });
    await prisma.application.deleteMany({ where: { job: { organizationId: stale.id } } });
    await prisma.organization.delete({ where: { id: stale.id } });
    await prisma.applicant.deleteMany({ where: { id: { in: staleApplicantIds } } });
  }

  const marker = `h1-${Date.now()}`;
  const applicantIds: string[] = [];
  const organization = await prisma.organization.create({
    data: {
      name: 'H1 Employee Core Test Organization',
      slug: marker,
      employeeNumberPrefix: 'H1T',
    },
  });
  const actor = await prisma.user.create({
    data: {
      organizationId: organization.id,
      name: 'H1 HR',
      email: `${marker}@example.test`,
      passwordHash: 'test-only',
      role: Role.HR_ADMIN,
    },
  });

  try {
    const jan31 = new Date('2028-01-31T00:00:00.000Z');
    assert(
      addCalendarMonthsClamped(jan31, 6).toISOString() === '2028-07-31T00:00:00.000Z',
      'six-month calculation clamps calendar month ends'
    );
    const teachingTerms = resolveInitialProbationTerms({
      category: EmploymentCategory.TEACHING,
      startDate: new Date('2024-06-01T00:00:00.000Z'),
      teachingExpectedEndAt: new Date('2025-03-31T00:00:00.000Z'),
    });
    assert(teachingTerms.maxRenewals === 2, 'Teaching allows two future renewals');
    assert(
      teachingTerms.expectedEndAt.toISOString() === '2025-03-31T00:00:00.000Z',
      'Teaching preserves an exact non-12-month school-year end date'
    );
    let missingTeachingDateRejected = false;
    try {
      resolveInitialProbationTerms({
        category: EmploymentCategory.TEACHING,
        startDate: new Date('2026-06-01T00:00:00.000Z'),
      });
    } catch {
      missingTeachingDateRejected = true;
    }
    assert(missingTeachingDateRejected, 'Teaching requires an explicit school-year end date');

    const nonTeaching = await createReadyApplication({
      organizationId: organization.id,
      actorUserId: actor.id,
      category: EmploymentCategory.NON_TEACHING,
      email: `${marker}-staff@example.test`,
      firstName: 'Nina',
      jobSuffix: 'staff',
      startDate: new Date('2026-06-30T00:00:00.000Z'),
    });
    applicantIds.push(nonTeaching.applicant.id);
    const first = await convertApplicationToEmployee({
      applicationId: nonTeaching.application.id,
      organizationId: organization.id,
      actorUserId: actor.id,
    });
    const firstEmployee = await prisma.employee.findUniqueOrThrow({
      where: { id: first.employeeId },
      include: { employmentRecords: { include: { probation: true } } },
    });
    const firstEmployment = firstEmployee.employmentRecords[0];
    assert(firstEmployee.employeeNumber.endsWith('-0001'), 'first tenant/year sequence is 0001');
    assert(firstEmployment.salary.toFixed(2) === '36000.00', 'accepted salary is snapshotted');
    assert(firstEmployment.payFrequency === PayFrequency.MONTHLY, 'pay frequency is snapshotted');
    assert(
      firstEmployment.probation?.expectedEndAt.toISOString() === '2026-12-30T00:00:00.000Z',
      'Non-Teaching probation ends after six calendar months'
    );

    const retry = await convertApplicationToEmployee({
      applicationId: nonTeaching.application.id,
      organizationId: organization.id,
      actorUserId: actor.id,
    });
    assert(retry.idempotent && retry.employeeId === first.employeeId, 'same Application retry is idempotent');

    const rehireJob = await prisma.job.create({
      data: {
        organizationId: organization.id,
        title: 'Rehire Attempt',
        slug: 'h1-rehire',
        department: 'Administration',
        employmentType: 'Full-Time',
        location: 'Campus',
        description: 'test', responsibilities: 'test', qualifications: 'test', requirements: 'test',
        category: EmploymentCategory.NON_TEACHING,
      },
    });
    const rehireApplication = await prisma.application.create({
      data: {
        jobId: rehireJob.id,
        applicantId: nonTeaching.applicant.id,
        status: ApplicationStatus.OFFER,
        coverLetter: 'rehire test',
      },
    });
    let rehireRejected = false;
    try {
      await convertApplicationToEmployee({
        applicationId: rehireApplication.id,
        organizationId: organization.id,
        actorUserId: actor.id,
      });
    } catch (error) {
      rehireRejected =
        error instanceof EmployeeConversionError && error.code === 'REHIRE_NOT_SUPPORTED';
    }
    assert(rehireRejected, 'different-Application rehire is explicitly rejected');

    const rollbackFixture = await createReadyApplication({
      organizationId: organization.id,
      actorUserId: actor.id,
      category: EmploymentCategory.NON_TEACHING,
      email: `${marker}-rollback@example.test`,
      firstName: 'Rina',
      jobSuffix: 'rollback',
      startDate: new Date('2026-07-01T00:00:00.000Z'),
    });
    applicantIds.push(rollbackFixture.applicant.id);
    await prisma.employeeNumberSequence.update({
      where: { organizationId_year: { organizationId: organization.id, year: new Date().getUTCFullYear() } },
      data: { nextValue: 1 },
    });
    let collisionFailed = false;
    try {
      await convertApplicationToEmployee({
        applicationId: rollbackFixture.application.id,
        organizationId: organization.id,
        actorUserId: actor.id,
      });
    } catch {
      collisionFailed = true;
    }
    const rolledBack = await prisma.application.findUniqueOrThrow({
      where: { id: rollbackFixture.application.id },
      include: { employee: true },
    });
    assert(collisionFailed, 'forced employee-number collision fails conversion');
    assert(rolledBack.status === ApplicationStatus.OFFER, 'failed conversion rolls back HIRED');
    assert(rolledBack.employee === null, 'failed conversion leaves no Employee');
    await prisma.employeeNumberSequence.update({
      where: { organizationId_year: { organizationId: organization.id, year: new Date().getUTCFullYear() } },
      data: { nextValue: 2 },
    });

    const teaching = await createReadyApplication({
      organizationId: organization.id,
      actorUserId: actor.id,
      category: EmploymentCategory.TEACHING,
      email: `${marker}-teacher@example.test`,
      firstName: 'Tina',
      jobSuffix: 'teacher',
      startDate: new Date('2024-06-01T00:00:00.000Z'),
    });
    applicantIds.push(teaching.applicant.id);
    const exactSchoolYearEnd = new Date('2025-03-31T00:00:00.000Z');
    const [teachingA, teachingB] = await Promise.all([
      convertApplicationToEmployee({
        applicationId: teaching.application.id,
        organizationId: organization.id,
        actorUserId: actor.id,
        teachingExpectedEndAt: exactSchoolYearEnd,
      }),
      convertApplicationToEmployee({
        applicationId: teaching.application.id,
        organizationId: organization.id,
        actorUserId: actor.id,
        teachingExpectedEndAt: exactSchoolYearEnd,
      }),
    ]);
    assert(teachingA.employeeId === teachingB.employeeId, 'concurrent conversion returns one Employee');
    const teachingEmployee = await prisma.employee.findUniqueOrThrow({
      where: { id: teachingA.employeeId },
      include: { employmentRecords: { include: { probation: true } } },
    });
    const teachingProbation = teachingEmployee.employmentRecords[0].probation;
    assert(teachingProbation?.renewalCount === 0, 'Teaching renewal count starts at zero');
    assert(teachingProbation?.maxRenewals === 2, 'Teaching max renewals is two');
    assert(teachingProbation?.decision === 'PENDING', 'Teaching decision remains pending');
    assert(teachingProbation?.probationStatus === 'ACTIVE', 'past end date causes no automatic status change');

    const wrongTenant = await getOrganizationEmployeeById('another-tenant', first.employeeId);
    assert(wrongTenant === null, 'cross-tenant Employee profile lookup returns no record');
    let crossTenantRejected = false;
    try {
      await convertApplicationToEmployee({
        applicationId: nonTeaching.application.id,
        organizationId: 'another-tenant',
        actorUserId: actor.id,
      });
    } catch (error) {
      crossTenantRejected =
        error instanceof EmployeeConversionError && error.code === 'APPLICATION_NOT_FOUND';
    }
    assert(crossTenantRejected, 'cross-tenant conversion is denied');

    const employeeCount = await prisma.employee.count({
      where: { organizationId: organization.id },
    });
    assert(employeeCount === 2, 'only the intended Staff and Teaching Employees exist');
    console.log('H1 Employee Core tests passed: 22 assertions.');
  } finally {
    await prisma.employee.deleteMany({ where: { organizationId: organization.id } });
    await prisma.application.deleteMany({
      where: { job: { organizationId: organization.id } },
    });
    await prisma.organization.delete({ where: { id: organization.id } });
    await prisma.applicant.deleteMany({ where: { id: { in: applicantIds } } });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
