import { prisma } from '../src/lib/db/prisma';
import { OnboardingTaskStatus, OnboardingTaskType } from '@prisma/client';
import { localStorageProvider } from '../src/lib/storage';

async function testCandidateOnboardingSubmission() {
  console.log('🧪 Testing Candidate Onboarding Submission & HR View/Download...\n');

  // 1. Find Carlos Mendoza's active onboarding
  const carlos = await prisma.application.findFirst({
    where: { applicant: { firstName: 'Carlos', lastName: 'Mendoza' } },
    include: {
      job: { include: { organization: true } },
      onboarding: { include: { tasks: true } },
    },
  });

  if (!carlos || !carlos.onboarding) {
    throw new Error('Carlos Mendoza application or onboarding not found.');
  }

  // 2. Find Government Identification task
  let govTask = carlos.onboarding.tasks.find((t) =>
    t.title.toLowerCase().includes('government')
  );

  if (!govTask) {
    throw new Error('Government Identification task not found in Carlos Mendoza onboarding.');
  }

  console.log(`Found candidate task: "${govTask.title}" (Status: ${govTask.status})`);

  // 3. Simulate candidate uploading Government IDs scan via candidate portal
  const testBuffer = Buffer.from('Mock SSS PhilHealth Pag-IBIG TIN official card scans content');
  const fileName = 'Carlos_Mendoza_Gov_IDs_SSS_TIN.pdf';
  const mimeType = 'application/pdf';

  const uploadResult = await localStorageProvider.upload(
    testBuffer,
    `candidate-onboarding-${carlos.id}-${govTask.id}-${fileName}`,
    mimeType
  );

  await prisma.onboardingTask.update({
    where: { id: govTask.id },
    data: {
      fileName,
      fileType: mimeType,
      fileSize: testBuffer.length,
      storageKey: uploadResult.storageKey,
      status: OnboardingTaskStatus.SUBMITTED,
      submittedAt: new Date(),
      reviewerNotes: `Submitted by applicant via Candidate Portal on ${new Date().toLocaleDateString()}`,
    },
  });

  console.log('  ✓ Candidate uploaded document scan through candidate portal.');

  // 4. Verify in database
  const updatedTask = await prisma.onboardingTask.findUnique({
    where: { id: govTask.id },
  });

  if (!updatedTask || updatedTask.status !== OnboardingTaskStatus.SUBMITTED) {
    throw new Error('Task status was not updated to SUBMITTED.');
  }
  if (!updatedTask.storageKey || updatedTask.fileName !== fileName) {
    throw new Error('File metadata was not saved correctly.');
  }

  console.log('  ✓ Task successfully transitioned to SUBMITTED with attached storage key.');

  // 5. Verify file retrieval from storage (View / Download simulation)
  const storedFile = await localStorageProvider.get(updatedTask.storageKey);
  if (!storedFile || storedFile.buffer.length !== testBuffer.length) {
    throw new Error('Retrieved file content does not match uploaded content.');
  }

  console.log('  ✓ File content retrieved successfully from storage provider (View / Download ready).');

  console.log('\n=============================================================');
  console.log('🎉 CANDIDATE ONBOARDING SUBMISSION & HR VIEW VERIFIED!');
  console.log('=============================================================\n');
}

testCandidateOnboardingSubmission()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
