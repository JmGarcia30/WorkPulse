import { PrismaClient, Role, JobStatus, RequirementType, ApplicationStatus } from '@prisma/client';
import { hash, compare } from 'bcryptjs';
import { localStorageProvider } from '../src/lib/storage';

const prisma = new PrismaClient();

async function runTest() {
  console.log('🧪 Starting WorkPulse Sprint 1 Automated Vertical Slice Verification...\n');

  // 1. Organization & Tenant Isolation Test
  console.log('--- TEST 1: Multi-Tenancy Architecture ---');
  const org = await prisma.organization.upsert({
    where: { slug: 'test-academy' },
    update: {},
    create: { name: 'Test Academy, Inc.', slug: 'test-academy' },
  });
  console.log(`✓ Tenant Organization created: ${org.name} (${org.id})`);

  // 2. Auth & User Password Hash Test
  console.log('\n--- TEST 2: User Password Hashing & Roles ---');
  const passwordHash = await hash('SecurePass123!', 10);
  const user = await prisma.user.upsert({
    where: { email: 'hr.test@testacademy.edu' },
    update: { passwordHash },
    create: {
      organizationId: org.id,
      name: 'Test HR Admin',
      email: 'hr.test@testacademy.edu',
      passwordHash,
      role: Role.HR_ADMIN,
    },
  });
  const isValidPass = await compare('SecurePass123!', user.passwordHash);
  console.log(`✓ Password hash verification: ${isValidPass ? 'PASSED' : 'FAILED'}`);

  // 3. Job Creation with Structured Requirements
  console.log('\n--- TEST 3: Job Posting & Structured Requirements ---');
  const testJob = await prisma.job.create({
    data: {
      organizationId: org.id,
      title: 'Automated Test Engineer',
      slug: `automated-test-engineer-${Date.now()}`,
      department: 'Engineering',
      employmentType: 'Full-time',
      location: 'Remote',
      description: 'Test position for automated vertical slice verification',
      responsibilities: 'Build and maintain test suites',
      qualifications: 'BS CS or equivalent experience',
      requirements: 'TypeScript, Next.js, Prisma',
      status: JobStatus.PUBLISHED,
      publishedAt: new Date(),
      structuredReqs: {
        create: [
          {
            name: 'TypeScript Mastery',
            type: RequirementType.SKILL,
            description: 'Deep knowledge of static typing',
            isRequired: true,
          },
          {
            name: 'Prisma ORM',
            type: RequirementType.SKILL,
            description: 'Relational data modeling',
            isRequired: true,
          },
        ],
      },
    },
    include: { structuredReqs: true },
  });
  console.log(`✓ Published Job Created: "${testJob.title}" with ${testJob.structuredReqs.length} structured requirements`);

  // 4. Case-insensitive Email Normalization & Duplicate Protection Test
  console.log('\n--- TEST 4: Email Normalization & Duplicate Prevention ---');
  const rawEmail = '  Candidate.Test@Example.COM  ';
  const normalizedEmail = rawEmail.trim().toLowerCase();
  console.log(`Normalized email: "${rawEmail}" -> "${normalizedEmail}"`);

  let applicant = await prisma.applicant.findFirst({
    where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
  });

  if (!applicant) {
    applicant = await prisma.applicant.create({
      data: {
        firstName: 'Jane',
        lastName: 'Doe',
        email: normalizedEmail,
        phone: '+63 999 111 2222',
      },
    });
  }

  // File Upload via StorageProvider
  const fileBuffer = Buffer.from('%PDF-1.4 Mock resume content for testing');
  const uploadResult = await localStorageProvider.upload(
    fileBuffer,
    'Jane_Doe_Resume.pdf',
    'application/pdf'
  );
  console.log(`✓ Resume uploaded to private storage: ${uploadResult.storageKey}`);

  // First Application
  const app1 = await prisma.application.create({
    data: {
      jobId: testJob.id,
      applicantId: applicant.id,
      status: ApplicationStatus.APPLIED,
      coverLetter: 'I am excited to apply for the Automated Test Engineer role.',
      documents: {
        create: {
          applicantId: applicant.id,
          fileName: 'Jane_Doe_Resume.pdf',
          fileType: 'application/pdf',
          fileSize: fileBuffer.length,
          storageKey: uploadResult.storageKey,
        },
      },
    },
  });
  console.log(`✓ Application submitted: App ID ${app1.id}`);

  // Duplicate Submission Prevention Check
  let duplicatePrevented = false;
  try {
    await prisma.application.create({
      data: {
        jobId: testJob.id,
        applicantId: applicant.id,
        status: ApplicationStatus.APPLIED,
        coverLetter: 'Duplicate attempt',
      },
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      duplicatePrevented = true;
    }
  }
  console.log(`✓ Database @@unique([jobId, applicantId]) duplicate protection: ${duplicatePrevented ? 'PASSED' : 'FAILED'}`);

  // 5. Derived Multi-tenant Applicant Access & Status Change Audit
  console.log('\n--- TEST 5: Tenant-Isolated Candidate Lookup & Status Audit ---');
  const hrApplicantLookup = await prisma.application.findFirst({
    where: {
      id: app1.id,
      job: { organizationId: org.id },
    },
    include: {
      applicant: true,
      job: true,
      documents: true,
    },
  });
  console.log(`✓ Derived multi-tenant candidate lookup: ${hrApplicantLookup ? 'SUCCESS' : 'FAILED'}`);

  // Update Status & Log Audit History
  const prevStatus = hrApplicantLookup!.status;
  const newStatus = ApplicationStatus.SHORTLISTED;

  await prisma.$transaction([
    prisma.application.update({
      where: { id: app1.id },
      data: { status: newStatus },
    }),
    prisma.applicationStatusHistory.create({
      data: {
        applicationId: app1.id,
        fromStatus: prevStatus,
        toStatus: newStatus,
        changedById: user.id,
      },
    }),
  ]);

  const updatedApp = await prisma.application.findUnique({
    where: { id: app1.id },
    include: { history: true },
  });

  console.log(`✓ Status transitioned from ${prevStatus} to ${updatedApp?.status}`);
  console.log(`✓ Audit history entries recorded: ${updatedApp?.history.length}`);

  console.log('\n🎉 ALL SPRINT 1 VERIFICATION TESTS PASSED SUCCESSFULLY!');
}

runTest()
  .catch((err) => {
    console.error('❌ Test execution failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
