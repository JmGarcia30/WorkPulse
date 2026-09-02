import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const documents = await prisma.document.findMany({
    select: {
      id: true,
      fileName: true,
      storageKey: true,
      applicant: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  console.log('Documents in database:');
  for (const doc of documents) {
    console.log(`  - ${doc.applicant.firstName} ${doc.applicant.lastName}: ${doc.fileName} (key: ${doc.storageKey})`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Error:', e);
  prisma.$disconnect();
  process.exit(1);
});
