import {
  PrismaClient,
  Role,
  JobStatus,
  RequirementType,
  ApplicationStatus,
  InterviewType,
  InterviewStatus,
  EvaluationRecommendation,
  AssessmentStatus,
  AssessmentType,
  OfferStatus,
  PayFrequency,
} from '@prisma/client';
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

  // 5. Create Interviews & Evaluations (Sprint 2.2)
  console.log('Seeding Interviews & Candidate Evaluations for both tenants...');

  // 5a. St. Aloysius Interview Seed: Grace Santos (Senior STEM Educator)
  const graceApp = await prisma.application.findUnique({
    where: {
      jobId_applicantId: {
        jobId: stemJob.id,
        applicantId: applicant4.id,
      },
    },
  });

  if (graceApp) {
    // Grace Santos: Completed Technical Interview
    let graceTechnicalInterview = await prisma.interview.findFirst({
      where: {
        applicationId: graceApp.id,
        type: InterviewType.TECHNICAL,
      },
    });

    if (!graceTechnicalInterview) {
      graceTechnicalInterview = await prisma.interview.create({
        data: {
          applicationId: graceApp.id,
          interviewerId: hrUser.id,
          type: InterviewType.TECHNICAL,
          status: InterviewStatus.COMPLETED,
          scheduledAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
          durationMinutes: 45,
          location: 'STEM Lab 102 - Science Building',
          meetingUrl: 'https://meet.google.com/sta-stem-tech-eval',
          notes: 'Detailed demonstration of advanced physics and calculus lesson plan.',
        },
      });
    }

    // Evaluation for Grace's Technical Interview
    await prisma.candidateEvaluation.upsert({
      where: {
        interviewId: graceTechnicalInterview.id,
      },
      update: {
        communicationScore: 5,
        technicalScore: 5,
        problemSolvingScore: 4,
        experienceScore: 4,
        cultureFitScore: 5,
        overallScore: 4.6,
        recommendation: EvaluationRecommendation.STRONGLY_RECOMMEND,
        comments:
          'Candidate demonstrated exceptional mastery of Physics and Mathematics curricula, clear pedagogical articulation, and deep alignment with Ignatian educational values.',
        evaluatedById: hrUser.id,
      },
      create: {
        interviewId: graceTechnicalInterview.id,
        communicationScore: 5,
        technicalScore: 5,
        problemSolvingScore: 4,
        experienceScore: 4,
        cultureFitScore: 5,
        overallScore: 4.6,
        recommendation: EvaluationRecommendation.STRONGLY_RECOMMEND,
        comments:
          'Candidate demonstrated exceptional mastery of Physics and Mathematics curricula, clear pedagogical articulation, and deep alignment with Ignatian educational values.',
        evaluatedById: hrUser.id,
      },
    });

    // Grace Santos: Scheduled Final Interview
    const existingGraceFinal = await prisma.interview.findFirst({
      where: {
        applicationId: graceApp.id,
        type: InterviewType.FINAL,
      },
    });

    if (!existingGraceFinal) {
      await prisma.interview.create({
        data: {
          applicationId: graceApp.id,
          interviewerId: managerUser.id,
          type: InterviewType.FINAL,
          status: InterviewStatus.SCHEDULED,
          scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days in future
          durationMinutes: 60,
          location: 'Executive Boardroom, Gonzaga Hall',
          notes: 'Final panel interview with Department Head and Hiring Committee.',
        },
      });
    }
  }

  // 5b. Test Academy Interview Seed: John Smith (Automated Test Engineer)
  const testJohnApp = await prisma.application.findUnique({
    where: {
      jobId_applicantId: {
        jobId: testJob1.id,
        applicantId: testApplicant2.id,
      },
    },
  });

  if (testJohnApp) {
    // Advance John Smith to INTERVIEW stage if not already
    if (testJohnApp.status !== ApplicationStatus.INTERVIEW) {
      await prisma.application.update({
        where: { id: testJohnApp.id },
        data: { status: ApplicationStatus.INTERVIEW },
      });

      await prisma.applicationStatusHistory.create({
        data: {
          applicationId: testJohnApp.id,
          fromStatus: ApplicationStatus.SCREENING,
          toStatus: ApplicationStatus.INTERVIEW,
          changedById: testHrUser.id,
        },
      });
    }

    // John Smith: Completed Initial Screening Interview
    let johnScreeningInterview = await prisma.interview.findFirst({
      where: {
        applicationId: testJohnApp.id,
        type: InterviewType.INITIAL_SCREENING,
      },
    });

    if (!johnScreeningInterview) {
      johnScreeningInterview = await prisma.interview.create({
        data: {
          applicationId: testJohnApp.id,
          interviewerId: testHrUser.id,
          type: InterviewType.INITIAL_SCREENING,
          status: InterviewStatus.COMPLETED,
          scheduledAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
          durationMinutes: 30,
          meetingUrl: 'https://meet.google.com/test-academy-screening-john',
          notes: 'Initial background screening and verification of QA automated testing tools.',
        },
      });
    }

    // Evaluation for John Smith's Initial Screening
    await prisma.candidateEvaluation.upsert({
      where: {
        interviewId: johnScreeningInterview.id,
      },
      update: {
        communicationScore: 4,
        technicalScore: 4,
        problemSolvingScore: 4,
        experienceScore: 3,
        cultureFitScore: 4,
        overallScore: 3.8,
        recommendation: EvaluationRecommendation.RECOMMEND,
        comments:
          'Solid automated testing background with Playwright and Cypress. Recommended to proceed to technical hands-on assessment round.',
        evaluatedById: testHrUser.id,
      },
      create: {
        interviewId: johnScreeningInterview.id,
        communicationScore: 4,
        technicalScore: 4,
        problemSolvingScore: 4,
        experienceScore: 3,
        cultureFitScore: 4,
        overallScore: 3.8,
        recommendation: EvaluationRecommendation.RECOMMEND,
        comments:
          'Solid automated testing background with Playwright and Cypress. Recommended to proceed to technical hands-on assessment round.',
        evaluatedById: testHrUser.id,
      },
    });

    // John Smith: Scheduled Technical Interview
    const existingJohnTech = await prisma.interview.findFirst({
      where: {
        applicationId: testJohnApp.id,
        type: InterviewType.TECHNICAL,
      },
    });

    if (!existingJohnTech) {
      await prisma.interview.create({
        data: {
          applicationId: testJohnApp.id,
          interviewerId: testHrUser.id,
          type: InterviewType.TECHNICAL,
          status: InterviewStatus.SCHEDULED,
          scheduledAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000), // 4 days in future
          durationMinutes: 60,
          meetingUrl: 'https://meet.google.com/test-academy-tech-round-john',
          notes: 'Live coding assessment covering integration testing with Prisma and Next.js.',
        },
      });
    }
  }

  console.log(`✓ Interviews and candidate evaluations seeded.`);

  // 6. Create Pre-Employment Assessments & Offers (Sprint 2.3)
  console.log('Seeding Pre-Employment Assessments & Offers for both tenants...');

  // 6a. St. Aloysius Candidate A: Grace Santos (Senior STEM Educator)
  // State: INTERVIEW -> Assessment ASSIGNED
  if (graceApp) {
    const existingGraceAss = await prisma.assessment.findFirst({
      where: {
        applicationId: graceApp.id,
        title: 'Senior STEM Pedagogy & Physics Laboratory Demonstration',
      },
    });

    if (!existingGraceAss) {
      await prisma.assessment.create({
        data: {
          applicationId: graceApp.id,
          title: 'Senior STEM Pedagogy & Physics Laboratory Demonstration',
          type: AssessmentType.TECHNICAL,
          description:
            'Conduct a 30-minute demonstration of a senior high school laboratory experiment on electromagnetism and submit a comprehensive lesson syllabus.',
          dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          maxScore: 100,
          passingScore: 80,
          status: AssessmentStatus.ASSIGNED,
          evaluatorId: hrUser.id,
        },
      });
    }
  }

  // 6b. St. Aloysius Candidate B: Mark Tan (Senior STEM Educator)
  // State: ASSESSMENT -> Assessment PASSED
  const markApp = await prisma.application.findUnique({
    where: {
      jobId_applicantId: {
        jobId: stemJob.id,
        applicantId: applicant3.id,
      },
    },
  });

  if (markApp) {
    if (markApp.status !== ApplicationStatus.ASSESSMENT) {
      await prisma.application.update({
        where: { id: markApp.id },
        data: { status: ApplicationStatus.ASSESSMENT },
      });
    }

    const existingMarkAss = await prisma.assessment.findFirst({
      where: {
        applicationId: markApp.id,
        title: 'Advanced Calculus & Mathematics Curriculum Design Challenge',
      },
    });

    if (!existingMarkAss) {
      await prisma.assessment.create({
        data: {
          applicationId: markApp.id,
          title: 'Advanced Calculus & Mathematics Curriculum Design Challenge',
          type: AssessmentType.SKILLS,
          description:
            'Design a 4-week modular syllabus for Senior High School AP Calculus AB including problem sets and rubric matrices.',
          dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          score: 92.5,
          maxScore: 100,
          passingScore: 75,
          status: AssessmentStatus.PASSED,
          submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          evaluatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          evaluatorId: hrUser.id,
          reviewerNotes:
            'Exceptional curriculum design with rigorous mathematical derivations and clear student-centered learning goals. Scored 92.5% (PASSED).',
        },
      });
    }
  }

  // 6c. St. Aloysius Candidate C: Carlos Mendoza (Senior STEM Educator)
  // State: OFFER -> Offer PENDING_APPROVAL
  const carlosApp = await prisma.application.findUnique({
    where: {
      jobId_applicantId: {
        jobId: stemJob.id,
        applicantId: applicant1.id,
      },
    },
  });

  if (carlosApp) {
    if (carlosApp.status !== ApplicationStatus.OFFER) {
      await prisma.application.update({
        where: { id: carlosApp.id },
        data: { status: ApplicationStatus.OFFER },
      });
    }

    // Assessment for Carlos
    const existingCarlosAss = await prisma.assessment.findFirst({
      where: {
        applicationId: carlosApp.id,
        title: 'Physics Problem Solving & Classroom Simulation',
      },
    });

    if (!existingCarlosAss) {
      await prisma.assessment.create({
        data: {
          applicationId: carlosApp.id,
          title: 'Physics Problem Solving & Classroom Simulation',
          type: AssessmentType.TECHNICAL,
          description: 'Problem-solving assessment and interactive classroom simulation.',
          score: 88,
          maxScore: 100,
          passingScore: 75,
          status: AssessmentStatus.PASSED,
          submittedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          evaluatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
          evaluatorId: hrUser.id,
          reviewerNotes: 'Strong analytical skills demonstrated in kinematics and dynamics.',
        },
      });
    }

    // Offer for Carlos (PENDING_APPROVAL)
    const existingCarlosOffer = await prisma.offer.findFirst({
      where: {
        applicationId: carlosApp.id,
      },
    });

    if (!existingCarlosOffer) {
      await prisma.offer.create({
        data: {
          applicationId: carlosApp.id,
          salary: 65000,
          payFrequency: PayFrequency.MONTHLY,
          employmentType: 'Full-time Permanent',
          startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          expirationDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
          benefits:
            'Comprehensive HMO coverage with 2 dependents, 15 days Vacation Leave, 15 days Sick Leave, 13th month pay, and Retirement Fund.',
          allowances: '₱3,000 monthly teaching supply and technology stipend.',
          additionalTerms:
            'Contingent on background check clearance and verification of PRC License credentials.',
          notes: 'Submitted for Executive Board approval by HR Committee.',
          status: OfferStatus.PENDING_APPROVAL,
          createdById: hrUser.id,
        },
      });
    }
  }

  // 6d. St. Aloysius Candidate D: Ana Reyes (Senior STEM Educator)
  // State: OFFER -> Offer SENT
  const anaApp = await prisma.application.findUnique({
    where: {
      jobId_applicantId: {
        jobId: stemJob.id,
        applicantId: applicant2.id,
      },
    },
  });

  if (anaApp) {
    if (anaApp.status !== ApplicationStatus.OFFER) {
      await prisma.application.update({
        where: { id: anaApp.id },
        data: { status: ApplicationStatus.OFFER },
      });
    }

    // Assessment for Ana
    const existingAnaAss = await prisma.assessment.findFirst({
      where: {
        applicationId: anaApp.id,
        title: 'STEM Foundational Knowledge & Logic Assessment',
      },
    });

    if (!existingAnaAss) {
      await prisma.assessment.create({
        data: {
          applicationId: anaApp.id,
          title: 'STEM Foundational Knowledge & Logic Assessment',
          type: AssessmentType.COGNITIVE,
          description: 'Cognitive reasoning and pedagogical fundamentals test.',
          score: 85,
          maxScore: 100,
          passingScore: 75,
          status: AssessmentStatus.PASSED,
          submittedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
          evaluatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          evaluatorId: hrUser.id,
        },
      });
    }

    // Offer for Ana (SENT)
    const existingAnaOffer = await prisma.offer.findFirst({
      where: {
        applicationId: anaApp.id,
      },
    });

    if (!existingAnaOffer) {
      await prisma.offer.create({
        data: {
          applicationId: anaApp.id,
          salary: 62000,
          payFrequency: PayFrequency.MONTHLY,
          employmentType: 'Full-time',
          startDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
          expirationDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
          benefits: 'Standard faculty HMO, 13th month pay, 15 days annual paid leaves.',
          allowances: '₱2,500 monthly connectivity and research allowance.',
          notes: 'Approved by Fr. Jose Rizal on committee review and transmitted to candidate.',
          status: OfferStatus.SENT,
          createdById: hrUser.id,
          approvedById: adminUser.id,
        },
      });
    }
  }

  // 6e. Test Academy Candidate E: Jane Doe (Automated Test Engineer)
  // State: HIRED -> Offer ACCEPTED
  const testJaneApp = await prisma.application.findUnique({
    where: {
      jobId_applicantId: {
        jobId: testJob1.id,
        applicantId: testApplicant1.id,
      },
    },
  });

  if (testJaneApp) {
    if (testJaneApp.status !== ApplicationStatus.HIRED) {
      await prisma.application.update({
        where: { id: testJaneApp.id },
        data: { status: ApplicationStatus.HIRED },
      });
    }

    // Assessment for Jane Doe
    const existingJaneAss = await prisma.assessment.findFirst({
      where: {
        applicationId: testJaneApp.id,
        title: 'Playwright & Next.js End-to-End Test Automation Challenge',
      },
    });

    if (!existingJaneAss) {
      await prisma.assessment.create({
        data: {
          applicationId: testJaneApp.id,
          title: 'Playwright & Next.js End-to-End Test Automation Challenge',
          type: AssessmentType.TECHNICAL,
          description: 'Construct end-to-end integration and regression suite for multi-tenant portal.',
          score: 96,
          maxScore: 100,
          passingScore: 80,
          status: AssessmentStatus.PASSED,
          submittedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
          evaluatedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          evaluatorId: testHrUser.id,
          reviewerNotes: 'Mastery of Playwright and TypeScript testing patterns. Scored 96%.',
        },
      });
    }

    // Offer for Jane Doe (ACCEPTED)
    const existingJaneOffer = await prisma.offer.findFirst({
      where: {
        applicationId: testJaneApp.id,
      },
    });

    if (!existingJaneOffer) {
      await prisma.offer.create({
        data: {
          applicationId: testJaneApp.id,
          salary: 95000,
          payFrequency: PayFrequency.MONTHLY,
          employmentType: 'Full-time Remote',
          startDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          expirationDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          benefits: 'Comprehensive health coverage, annual education budget, flexitime.',
          allowances: '₱5,000 monthly home-office and high-speed internet stipend.',
          notes: 'Candidate accepted offer terms and completed onboarding.',
          status: OfferStatus.ACCEPTED,
          createdById: testHrUser.id,
          approvedById: testHrUser.id,
        },
      });
    }
  }

  console.log(`✓ Pre-employment assessments and offers seeded.`);
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
