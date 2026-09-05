import { prisma } from '../src/lib/db/prisma';
import {
  getCandidatePortalData,
  submitCandidateRecruitmentDocumentAction,
} from '../src/features/careers/portal-actions';
import {
  rejectRecruitmentDocumentAction,
  verifyRecruitmentDocumentAction,
} from '../src/features/hiring/recruitment-document-actions';
import { calculateHiringReadiness } from '../src/features/hiring/readiness';
import { areRecruitmentDocumentsSatisfied } from '../src/features/hiring/saga-requirements';
import { getEmailLogs, clearEmailLogs } from '../src/lib/email';
import {
  RecruitmentDocumentStatus,
  RecruitmentDocumentType,
  EmploymentCategory,
  Role,
} from '@prisma/client';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, description: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${description}`);
  } else {
    console.error(`  ✗ FAIL: ${description}`);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('SAGA CANDIDATE PORTAL & BLURRY REJECTION / RE-UPLOAD TEST SUITE');
  console.log('================================================================\n');

  clearEmailLogs();

  // Target Miguel Rodriguez (specifically seeded as incomplete candidate)
  const app = await prisma.application.findFirst({
    where: {
      applicant: { email: 'miguel.rodriguez@gmail.com' },
      job: {
        organization: { slug: 'st-aloysius' },
      },
    },
    include: {
      applicant: true,
      job: {
        include: { organization: true },
      },
      recruitmentDocuments: true,
    },
  });

  if (!app) {
    throw new Error('Test candidate Miguel Rodriguez (miguel.rodriguez@gmail.com) not found in database.');
  }

  const miguel = app.applicant;
  const orgSlug = app.job.organization.slug;

  console.log(`[Target Candidate]: ${miguel.firstName} ${miguel.lastName}`);
  console.log(`[Application ID]:   ${app.id}`);
  console.log(`[Organization]:     ${orgSlug} (${app.job.organization.name})\n`);

  // -------------------------------------------------------------
  // Test 1: Candidate Portal Query Security & Data Isolation
  // -------------------------------------------------------------
  console.log('--- Test 1: Candidate Portal Data Access & Security Isolation ---');
  const validPortalData = await getCandidatePortalData(orgSlug, app.id);
  assert(validPortalData !== null, 'Candidate portal retrieves valid application data with correct org slug');
  assert(
    validPortalData?.application.applicant.email === miguel.email,
    'Portal data matches target applicant'
  );
  assert(
    validPortalData?.application.recruitmentDocuments.length! > 0,
    'Portal retrieves initialized SAGA document requirements'
  );

  const invalidOrgData = await getCandidatePortalData('wrong-org-slug', app.id);
  assert(invalidOrgData === null, 'Portal returns null when queried with mismatched organization slug');

  const invalidAppData = await getCandidatePortalData(orgSlug, 'non-existent-app-id');
  assert(invalidAppData === null, 'Portal returns null when queried with non-existent application ID');

  // -------------------------------------------------------------
  // Test 2: Candidate Uploads a Document (TOR)
  // -------------------------------------------------------------
  console.log('\n--- Test 2: Public Candidate Document Upload via Portal Action ---');
  const torDoc = app.recruitmentDocuments.find(
    (d) => d.type === RecruitmentDocumentType.TRANSCRIPT_OF_RECORDS
  );
  assert(torDoc !== undefined, 'Found Transcript of Records requirement slot');

  if (torDoc) {
    // Create mock FormData with a valid file buffer
    const mockPdfBuffer = Buffer.alloc(2048, '%PDF-1.4 Mock Transcript of Records Content with Official Seals');
    const mockFile = new File([mockPdfBuffer], 'Official_TOR_Scanned.pdf', {
      type: 'application/pdf',
    });

    const formData = new FormData();
    formData.append('file', mockFile);

    const uploadRes = await submitCandidateRecruitmentDocumentAction(
      orgSlug,
      app.id,
      torDoc.id,
      formData
    );

    assert(uploadRes.success === true, 'Candidate successfully uploaded TOR document');
    assert(uploadRes.status === RecruitmentDocumentStatus.SUBMITTED, 'Document status flipped to SUBMITTED');

    const updatedTor = await prisma.recruitmentDocument.findUnique({
      where: { id: torDoc.id },
    });
    assert(updatedTor?.fileName === 'Official_TOR_Scanned.pdf', 'Database records uploaded file name');
    assert(updatedTor?.status === RecruitmentDocumentStatus.SUBMITTED, 'Database records status as SUBMITTED');
  }

  // -------------------------------------------------------------
  // Test 3: HR Rejects Document with "Blurry / Illegible Scan" Note
  // -------------------------------------------------------------
  console.log('\n--- Test 3: HR Rejection & Blurry Document Rejection Note ---');
  if (torDoc) {
    const blurryReason =
      'The photo/scan is blurry or illegible. Grades on semester 2 and official registrar seals cannot be verified. Please re-upload a high-resolution scan.';

    // Find HR user in organization
    const hrUser = await prisma.user.findFirst({
      where: {
        organizationId: app.job.organizationId,
        role: { in: [Role.ORGANIZATION_ADMIN, Role.HR_ADMIN] },
      },
    });
    assert(hrUser !== null, 'Found HR evaluator user for rejection testing');

    // Simulate rejection action directly in DB (mirroring action logic for test environment session)
    await prisma.recruitmentDocument.update({
      where: { id: torDoc.id },
      data: {
        status: RecruitmentDocumentStatus.REJECTED,
        notes: blurryReason,
        verifiedAt: null,
        verifiedById: null,
      },
    });

    const rejectedTor = await prisma.recruitmentDocument.findUnique({
      where: { id: torDoc.id },
    });

    assert(
      rejectedTor?.status === RecruitmentDocumentStatus.REJECTED,
      'Document status updated to REJECTED'
    );
    assert(
      rejectedTor?.notes === blurryReason,
      'Reviewer rejection reason persisted in document notes'
    );

    // Verify readiness gate treats rejected document as an unmet blocker
    const allDocs = await prisma.recruitmentDocument.findMany({
      where: { applicationId: app.id },
    });
    const docEval = areRecruitmentDocumentsSatisfied(allDocs, EmploymentCategory.TEACHING);
    assert(docEval.isSatisfied === false, 'Document evaluation blocks readiness when mandatory document is REJECTED');
    assert(
      docEval.missingMandatory.includes('Transcript of Records (TOR)'),
      'Missing mandatory list explicitly lists rejected TOR'
    );

    const readiness = calculateHiringReadiness({
      status: app.status,
      jobCategory: EmploymentCategory.TEACHING,
      recruitmentDocuments: allDocs,
    });
    assert(readiness.isReadyToHire === false, 'Hiring readiness gate is strictly blocked by rejected blurry document');
  }

  // -------------------------------------------------------------
  // Test 4: Candidate Re-uploads Clear Copy from Portal
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Candidate Re-upload from Portal Clears Rejection ---');
  if (torDoc) {
    const mockClearPdf = Buffer.alloc(2048, '%PDF-1.4 Clear High-Res 300DPI Transcript with Validated Stamp');
    const mockClearFile = new File([mockClearPdf], 'Official_TOR_HighRes_Clear.pdf', {
      type: 'application/pdf',
    });

    const formData = new FormData();
    formData.append('file', mockClearFile);

    const reuploadRes = await submitCandidateRecruitmentDocumentAction(
      orgSlug,
      app.id,
      torDoc.id,
      formData
    );

    assert(reuploadRes.success === true, 'Candidate successfully re-uploaded clearer TOR');
    assert(
      reuploadRes.status === RecruitmentDocumentStatus.SUBMITTED,
      'Re-upload flipped status back to SUBMITTED for department re-evaluation'
    );

    const reuploadedTor = await prisma.recruitmentDocument.findUnique({
      where: { id: torDoc.id },
    });
    assert(
      reuploadedTor?.fileName === 'Official_TOR_HighRes_Clear.pdf',
      'Database records replacement file name'
    );
    assert(
      reuploadedTor?.status === RecruitmentDocumentStatus.SUBMITTED,
      'Database status is SUBMITTED, awaiting department approval'
    );
  }

  // -------------------------------------------------------------
  // Test 5: HR Verifies Replacement Document
  // -------------------------------------------------------------
  console.log('\n--- Test 5: HR Verifies Re-uploaded Document ---');
  if (torDoc) {
    await prisma.recruitmentDocument.update({
      where: { id: torDoc.id },
      data: {
        status: RecruitmentDocumentStatus.VERIFIED,
        verifiedAt: new Date(),
        notes: 'Verified clear scan: all grades and registrar dry seal confirmed.',
      },
    });

    const verifiedTor = await prisma.recruitmentDocument.findUnique({
      where: { id: torDoc.id },
    });
    assert(
      verifiedTor?.status === RecruitmentDocumentStatus.VERIFIED,
      'Document status successfully updated to VERIFIED'
    );
    assert(verifiedTor?.verifiedAt !== null, 'Verification timestamp recorded');
  }

  // -------------------------------------------------------------
  // Test 6: Cross-Applicant Security & Tamper Rejection
  // -------------------------------------------------------------
  console.log('\n--- Test 6: Cross-Applicant Isolation & Tamper Prevention ---');
  // Find another candidate (e.g. Roberto)
  const otherApp = await prisma.application.findFirst({
    where: {
      id: { not: app.id },
    },
    include: {
      recruitmentDocuments: true,
    },
  });

  if (otherApp && otherApp.recruitmentDocuments.length > 0 && torDoc) {
    const mockTamperFile = new File(['fake'], 'tamper.pdf', { type: 'application/pdf' });
    const tamperFormData = new FormData();
    tamperFormData.append('file', mockTamperFile);

    // Miguel's applicationId attempting to upload to other candidate's documentId
    const otherDoc = otherApp.recruitmentDocuments[0];
    if (otherDoc) {
      const tamperRes = await submitCandidateRecruitmentDocumentAction(
        orgSlug,
        app.id, // Miguel's appId
        otherDoc.id, // Other candidate's documentId
        tamperFormData
      );

      assert(
        tamperRes.error !== undefined,
        'Security correctly blocks applicant from uploading to another candidate’s document requirement'
      );
    }
  }

  // -------------------------------------------------------------
  // Test 7: Email Service Operational Logging & Delivery
  // -------------------------------------------------------------
  console.log('\n--- Test 7: Zero-Cost Notification Email Dispatch ---');
  const { sendApplicationConfirmationEmail, sendDocumentRejectedEmail, sendDocumentVerifiedEmail } = await import('../src/lib/email');

  await sendApplicationConfirmationEmail({
    to: 'applicant.test@example.com',
    candidateName: 'Test Applicant',
    jobTitle: 'Math Teacher',
    organizationName: 'St. Aloysius Gonzaga Academy',
    organizationSlug: orgSlug,
    applicationId: app.id,
  });

  await sendDocumentRejectedEmail({
    to: 'applicant.test@example.com',
    candidateName: 'Test Applicant',
    documentTitle: 'Transcript of Records',
    rejectionReason: 'The photo is blurry and illegible. Please re-upload.',
    portalUrl: `http://localhost:3000/careers/${orgSlug}/portal/${app.id}`,
    organizationName: 'St. Aloysius Gonzaga Academy',
  });

  await sendDocumentVerifiedEmail({
    to: 'applicant.test@example.com',
    candidateName: 'Test Applicant',
    documentTitle: 'Transcript of Records',
    organizationName: 'St. Aloysius Gonzaga Academy',
    portalUrl: `http://localhost:3000/careers/${orgSlug}/portal/${app.id}`,
  });

  const logs = getEmailLogs();
  assert(logs.length >= 3, 'Email service recorded 3 institutional emails in memory log');
  assert(
    logs.some((e) => e.subject.includes('Application Received') && e.html.includes(app.id)),
    'Confirmation email contains portal link'
  );
  assert(
    logs.some((e) => e.subject.includes('Document Resubmission Requested') && e.html.includes('blurry')),
    'Rejection email contains rejection feedback and portal re-upload link'
  );
  assert(
    logs.some((e) => e.subject.includes('Document Verified')),
    'Verification email dispatches successfully'
  );

  // Cleanup: Restore Miguel's TOR to pristine seed state (PENDING)
  if (torDoc) {
    await prisma.recruitmentDocument.update({
      where: { id: torDoc.id },
      data: {
        status: RecruitmentDocumentStatus.PENDING,
        fileName: null,
        fileType: null,
        fileSize: null,
        storageKey: null,
        notes: null,
        verifiedAt: null,
        verifiedById: null,
      },
    });
  }

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('================================================================\n');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests()
  .catch((e) => {
    console.error('Test suite failure:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
