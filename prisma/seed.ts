import { PrismaClient, Role, JobStatus, RequirementType, ApplicationStatus } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding WorkPulse database with 100% idempotent data...');

  // Clean duplicate temporary test jobs/applications from earlier test runs
  await prisma.job.deleteMany({
    where: {
      slug: { startsWith: 'automated-test-engineer-' },
    },
  });

  // 1. Create Main Organization: St. Aloysius Gonzaga Academy
  const org = await prisma.organization.upsert({
    where: { slug: 'st-aloysius' },
    update: {
      name: 'St. Aloysius Gonzaga Academy, Inc.',
      description:
        'A premier Catholic educational institution dedicated to academic excellence, character formation, and holistic student development in Senior High School and basic education.',
      logoUrl: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=200',
      careersEnabled: true,
    },
    create: {
      name: 'St. Aloysius Gonzaga Academy, Inc.',
      slug: 'st-aloysius',
      description:
        'A premier Catholic educational institution dedicated to academic excellence, character formation, and holistic student development in Senior High School and basic education.',
      logoUrl: 'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&q=80&w=200',
      careersEnabled: true,
    },
  });

  console.log(`✓ Organization created/updated: ${org.name} (slug: ${org.slug})`);

  // 1b. Create Secondary Multi-Tenant Test Organization: Test Academy
  const testOrg = await prisma.organization.upsert({
    where: { slug: 'test-academy' },
    update: {
      name: 'Test Academy, Inc.',
      description:
        'A modern STEM & Software Innovation Institute empowering engineers and technologists through hands-on technical learning.',
      logoUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=200',
      careersEnabled: true,
    },
    create: {
      name: 'Test Academy, Inc.',
      slug: 'test-academy',
      description:
        'A modern STEM & Software Innovation Institute empowering engineers and technologists through hands-on technical learning.',
      logoUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=200',
      careersEnabled: true,
    },
  });

  console.log(`✓ Secondary Organization created/updated: ${testOrg.name} (slug: ${testOrg.slug})`);

  // 2. Create Users
  const adminPassword = await hash('Admin123!', 10);
  const hrPassword = await hash('Hr123!', 10);
  const managerPassword = await hash('Manager123!', 10);
  const testHrPassword = await hash('Test123!', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@staloysius.edu' },
    update: { passwordHash: adminPassword },
    create: {
      organizationId: org.id,
      name: 'Fr. Jose Rizal, SJ',
      email: 'admin@staloysius.edu',
      passwordHash: adminPassword,
      role: Role.ORGANIZATION_ADMIN,
    },
  });

  const hrUser = await prisma.user.upsert({
    where: { email: 'hr@staloysius.edu' },
    update: { passwordHash: hrPassword },
    create: {
      organizationId: org.id,
      name: 'Maria Santos',
      email: 'hr@staloysius.edu',
      passwordHash: hrPassword,
      role: Role.HR_ADMIN,
    },
  });

  const managerUser = await prisma.user.upsert({
    where: { email: 'manager@staloysius.edu' },
    update: { passwordHash: managerPassword },
    create: {
      organizationId: org.id,
      name: 'Dr. Juan Dela Cruz',
      email: 'manager@staloysius.edu',
      passwordHash: managerPassword,
      role: Role.HIRING_MANAGER,
    },
  });

  const testHrUser = await prisma.user.upsert({
    where: { email: 'hr.test@testacademy.edu' },
    update: { passwordHash: testHrPassword },
    create: {
      organizationId: testOrg.id,
      name: 'Test HR Admin',
      email: 'hr.test@testacademy.edu',
      passwordHash: testHrPassword,
      role: Role.HR_ADMIN,
    },
  });

  console.log(
    `✓ Users created/updated: ${adminUser.email}, ${hrUser.email}, ${managerUser.email}, ${testHrUser.email}`
  );

  // 3. Create Jobs for St. Aloysius
  const stemJob = await prisma.job.upsert({
    where: {
      organizationId_slug: {
        organizationId: org.id,
        slug: 'senior-stem-educator',
      },
    },
    update: {
      status: JobStatus.PUBLISHED,
    },
    create: {
      organizationId: org.id,
      title: 'Senior STEM Educator',
      slug: 'senior-stem-educator',
      department: 'Academic Affairs',
      employmentType: 'Full-time',
      location: 'Main Campus - Quezon City',
      description:
        'We are seeking an experienced Senior STEM Educator to lead senior high school Physics and Advanced Mathematics classes.',
      responsibilities:
        '• Teach Senior High School General Physics, Calculus, and Computer Science fundamentals.\n• Develop modern laboratory experiments.',
      qualifications:
        '• Master’s degree in Physics, Mathematics, Education, or related STEM field.\n• Licensed Professional Teacher (LPT) credential.',
      requirements:
        'Valid LPT License, Master degree in STEM field, and minimum 3 years classroom experience.',
      status: JobStatus.PUBLISHED,
      publishedAt: new Date(),
      closingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      structuredReqs: {
        create: [
          {
            name: 'Licensed Professional Teacher (LPT)',
            type: RequirementType.CERTIFICATION,
            description: 'Valid PRC Professional Teacher license',
            isRequired: true,
          },
          {
            name: 'Master’s Degree in STEM Field',
            type: RequirementType.EDUCATION,
            description: 'Master of Science or Education',
            isRequired: true,
          },
        ],
      },
    },
  });

  const counselorJob = await prisma.job.upsert({
    where: {
      organizationId_slug: {
        organizationId: org.id,
        slug: 'school-guidance-counselor',
      },
    },
    update: {
      status: JobStatus.PUBLISHED,
    },
    create: {
      organizationId: org.id,
      title: 'School Guidance Counselor',
      slug: 'school-guidance-counselor',
      department: 'Student Affairs',
      employmentType: 'Full-time',
      location: 'Main Campus - Quezon City',
      description:
        'The School Guidance Counselor provides emotional, career, and academic counseling to junior and senior high school students.',
      responsibilities:
        '• Conduct individual and group counseling sessions.\n• Administer psychological assessments.',
      qualifications:
        '• Degree in Guidance and Counseling, Psychology.\n• Registered Guidance Counselor (RGC) License.',
      requirements: 'Registered Guidance Counselor (RGC) License.',
      status: JobStatus.PUBLISHED,
      publishedAt: new Date(),
      closingDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      structuredReqs: {
        create: [
          {
            name: 'Registered Guidance Counselor (RGC) License',
            type: RequirementType.CERTIFICATION,
            description: 'PRC Board Certification in Guidance & Counseling',
            isRequired: true,
          },
        ],
      },
    },
  });

  const itJob = await prisma.job.upsert({
    where: {
      organizationId_slug: {
        organizationId: org.id,
        slug: 'it-operations-lead',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      title: 'IT Operations Lead',
      slug: 'it-operations-lead',
      department: 'Information Technology',
      employmentType: 'Full-time',
      location: 'Main Campus - Quezon City',
      description: 'Oversee campus computer network infrastructure and server administration.',
      responsibilities: '• Manage campus Wi-Fi, firewall security, and local servers.',
      qualifications: '• BS Computer Science or IT.',
      requirements: 'BS IT/CS with network administration background.',
      status: JobStatus.DRAFT,
      structuredReqs: {
        create: [
          {
            name: 'Network Administration',
            type: RequirementType.SKILL,
            description: 'Router and firewall configuration',
            isRequired: true,
          },
        ],
      },
    },
  });

  // 3b. Create Jobs for Test Academy
  const testJob1 = await prisma.job.upsert({
    where: {
      organizationId_slug: {
        organizationId: testOrg.id,
        slug: 'automated-test-engineer',
      },
    },
    update: {
      status: JobStatus.PUBLISHED,
    },
    create: {
      organizationId: testOrg.id,
      title: 'Automated Test Engineer',
      slug: 'automated-test-engineer',
      department: 'Software Engineering',
      employmentType: 'Full-time',
      location: 'Remote',
      description: 'Lead automated testing and QA infrastructure for institutional applications.',
      responsibilities: '• Write end-to-end integration tests and regression suites.',
      qualifications: '• BS CS or equivalent software engineering background.',
      requirements: 'TypeScript, Next.js, Prisma',
      status: JobStatus.PUBLISHED,
      publishedAt: new Date(),
      structuredReqs: {
        create: [
          {
            name: 'TypeScript & Node.js',
            type: RequirementType.SKILL,
            description: 'Full stack TypeScript proficiency',
            isRequired: true,
          },
        ],
      },
    },
  });

  const testJob2 = await prisma.job.upsert({
    where: {
      organizationId_slug: {
        organizationId: testOrg.id,
        slug: 'fullstack-curriculum-lead',
      },
    },
    update: {},
    create: {
      organizationId: testOrg.id,
      title: 'Full-Stack Curriculum Lead',
      slug: 'fullstack-curriculum-lead',
      department: 'Curriculum & Instruction',
      employmentType: 'Full-time',
      location: 'Remote',
      description: 'Design modern web development curriculum covering Next.js, React, and PostgreSQL.',
      responsibilities: '• Author hands-on coding modules and lab exercises.',
      qualifications: '• 4+ years industry experience in web development.',
      requirements: 'React, Next.js, TypeScript, PostgreSQL',
      status: JobStatus.PUBLISHED,
      publishedAt: new Date(),
      structuredReqs: {
        create: [
          {
            name: 'Next.js & React Mastery',
            type: RequirementType.SKILL,
            description: 'App Router and React Server Components expertise',
            isRequired: true,
          },
        ],
      },
    },
  });

  console.log(
    `✓ Jobs created/updated: ${stemJob.title}, ${counselorJob.title}, ${itJob.title}, ${testJob1.title}, ${testJob2.title}`
  );

  // 4. Create Applicants & Applications for St. Aloysius
  // Senior STEM Educator Candidates:
  const applicant1 = await prisma.applicant.upsert({
    where: { email: 'carlos.mendoza@gmail.com' },
    update: {},
    create: {
      firstName: 'Carlos',
      lastName: 'Mendoza',
      email: 'carlos.mendoza@gmail.com',
      phone: '+63 917 555 0123',
    },
  });

  await prisma.application.upsert({
    where: {
      jobId_applicantId: {
        jobId: stemJob.id,
        applicantId: applicant1.id,
      },
    },
    update: {},
    create: {
      jobId: stemJob.id,
      applicantId: applicant1.id,
      status: ApplicationStatus.SHORTLISTED,
      coverLetter:
        'Dear Hiring Committee,\n\nI am thrilled to apply for the Senior STEM Educator position at St. Aloysius Gonzaga Academy.',
      documents: {
        create: {
          applicantId: applicant1.id,
          fileName: 'Carlos_Mendoza_CV.pdf',
          fileType: 'application/pdf',
          fileSize: 245000,
          storageKey: 'seed-carlos-mendoza-cv.pdf',
        },
      },
      history: {
        create: [
          {
            fromStatus: ApplicationStatus.APPLIED,
            toStatus: ApplicationStatus.SCREENING,
            changedById: hrUser.id,
          },
          {
            fromStatus: ApplicationStatus.SCREENING,
            toStatus: ApplicationStatus.SHORTLISTED,
            changedById: hrUser.id,
          },
        ],
      },
    },
  });

  const applicant2 = await prisma.applicant.upsert({
    where: { email: 'ana.reyes@gmail.com' },
    update: {},
    create: {
      firstName: 'Ana',
      lastName: 'Reyes',
      email: 'ana.reyes@gmail.com',
      phone: '+63 918 123 4567',
    },
  });

  await prisma.application.upsert({
    where: {
      jobId_applicantId: {
        jobId: stemJob.id,
        applicantId: applicant2.id,
      },
    },
    update: {},
    create: {
      jobId: stemJob.id,
      applicantId: applicant2.id,
      status: ApplicationStatus.APPLIED,
      coverLetter: 'Applying for Senior STEM Educator role with 5 years experience teaching Physics.',
    },
  });

  const applicant3 = await prisma.applicant.upsert({
    where: { email: 'mark.tan@gmail.com' },
    update: {},
    create: {
      firstName: 'Mark',
      lastName: 'Tan',
      email: 'mark.tan@gmail.com',
      phone: '+63 919 234 5678',
    },
  });

  await prisma.application.upsert({
    where: {
      jobId_applicantId: {
        jobId: stemJob.id,
        applicantId: applicant3.id,
      },
    },
    update: {},
    create: {
      jobId: stemJob.id,
      applicantId: applicant3.id,
      status: ApplicationStatus.SCREENING,
      coverLetter: 'Experienced STEM instructor specializing in advanced mathematics and calculus.',
      history: {
        create: [
          {
            fromStatus: ApplicationStatus.APPLIED,
            toStatus: ApplicationStatus.SCREENING,
            changedById: hrUser.id,
          },
        ],
      },
    },
  });

  const applicant4 = await prisma.applicant.upsert({
    where: { email: 'grace.santos@gmail.com' },
    update: {},
    create: {
      firstName: 'Grace',
      lastName: 'Santos',
      email: 'grace.santos@gmail.com',
      phone: '+63 920 345 6789',
    },
  });

  await prisma.application.upsert({
    where: {
      jobId_applicantId: {
        jobId: stemJob.id,
        applicantId: applicant4.id,
      },
    },
    update: {},
    create: {
      jobId: stemJob.id,
      applicantId: applicant4.id,
      status: ApplicationStatus.INTERVIEW,
      coverLetter: 'STEM curriculum developer and licensed teacher seeking Senior STEM Educator position.',
      history: {
        create: [
          {
            fromStatus: ApplicationStatus.APPLIED,
            toStatus: ApplicationStatus.SCREENING,
            changedById: hrUser.id,
          },
          {
            fromStatus: ApplicationStatus.SCREENING,
            toStatus: ApplicationStatus.SHORTLISTED,
            changedById: hrUser.id,
          },
          {
            fromStatus: ApplicationStatus.SHORTLISTED,
            toStatus: ApplicationStatus.INTERVIEW,
            changedById: hrUser.id,
          },
        ],
      },
    },
  });

  // School Guidance Counselor Candidates:
  const applicant5 = await prisma.applicant.upsert({
    where: { email: 'maria.clara@gmail.com' },
    update: {},
    create: {
      firstName: 'Maria',
      lastName: 'Clara',
      email: 'maria.clara@gmail.com',
      phone: '+63 921 456 7890',
    },
  });

  await prisma.application.upsert({
    where: {
      jobId_applicantId: {
        jobId: counselorJob.id,
        applicantId: applicant5.id,
      },
    },
    update: {},
    create: {
      jobId: counselorJob.id,
      applicantId: applicant5.id,
      status: ApplicationStatus.APPLIED,
      coverLetter: 'Registered Guidance Counselor with expertise in student adolescent counseling.',
    },
  });

  const applicant6 = await prisma.applicant.upsert({
    where: { email: 'jose.rizaljr@gmail.com' },
    update: {},
    create: {
      firstName: 'Jose',
      lastName: 'Rizal Jr.',
      email: 'jose.rizaljr@gmail.com',
      phone: '+63 922 567 8901',
    },
  });

  await prisma.application.upsert({
    where: {
      jobId_applicantId: {
        jobId: counselorJob.id,
        applicantId: applicant6.id,
      },
    },
    update: {},
    create: {
      jobId: counselorJob.id,
      applicantId: applicant6.id,
      status: ApplicationStatus.SCREENING,
      coverLetter: 'Licensed Counselor focused on educational and career guidance.',
      history: {
        create: [
          {
            fromStatus: ApplicationStatus.APPLIED,
            toStatus: ApplicationStatus.SCREENING,
            changedById: hrUser.id,
          },
        ],
      },
    },
  });

  // 4b. Create Applicants & Applications for Test Academy
  const testApplicant1 = await prisma.applicant.upsert({
    where: { email: 'jane.doe@example.com' },
    update: {},
    create: {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@example.com',
      phone: '+63 999 111 2222',
    },
  });

  await prisma.application.upsert({
    where: {
      jobId_applicantId: {
        jobId: testJob1.id,
        applicantId: testApplicant1.id,
      },
    },
    update: {},
    create: {
      jobId: testJob1.id,
      applicantId: testApplicant1.id,
      status: ApplicationStatus.APPLIED,
      coverLetter: 'I am applying for the Automated Test Engineer position at Test Academy.',
    },
  });

  const testApplicant2 = await prisma.applicant.upsert({
    where: { email: 'john.smith@example.com' },
    update: {},
    create: {
      firstName: 'John',
      lastName: 'Smith',
      email: 'john.smith@example.com',
      phone: '+63 999 333 4444',
    },
  });

  await prisma.application.upsert({
    where: {
      jobId_applicantId: {
        jobId: testJob1.id,
        applicantId: testApplicant2.id,
      },
    },
    update: {},
    create: {
      jobId: testJob1.id,
      applicantId: testApplicant2.id,
      status: ApplicationStatus.SCREENING,
      coverLetter: 'QA Automation Specialist with Playwright and Cypress experience.',
      history: {
        create: [
          {
            fromStatus: ApplicationStatus.APPLIED,
            toStatus: ApplicationStatus.SCREENING,
            changedById: testHrUser.id,
          },
        ],
      },
    },
  });

  console.log(`✓ Applicants & Applications created.`);
  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
