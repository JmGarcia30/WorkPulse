import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Finding applications with documents...');

  const applications = await prisma.application.findMany({
    include: {
      applicant: true,
      job: { include: { structuredReqs: true } },
      documents: true,
    },
    take: 3,
  });

  console.log(`Found ${applications.length} applications`);

  for (const app of applications) {
    console.log(`\nProcessing: ${app.applicant.firstName} ${app.applicant.lastName}`);
    console.log(`  Job: ${app.job.title}`);
    console.log(`  Documents: ${app.documents.length}`);

    if (app.documents.length === 0) {
      console.log('  Skipping - no documents');
      continue;
    }

    const doc = app.documents[0];
    console.log(`  Using document: ${doc.fileName}`);

    // Create mock parsed resume data
    const mockParsedResume = {
      summary: `Experienced ${app.job.title} with over 5 years of professional experience in educational institutions. Strong background in curriculum development, student guidance, and academic administration. Demonstrated ability to work collaboratively with faculty, staff, and administration to achieve institutional goals.`,
      skills: [
        'Student Counseling',
        'Career Guidance',
        'Academic Advising',
        'Crisis Intervention',
        'Microsoft Office',
        'Google Workspace',
        'Data Analysis',
        'Report Writing',
        'Group Facilitation',
        'Parent Communication',
        'IEP Development',
        'Behavioral Assessment',
      ],
      education: [
        {
          institution: 'University of the Philippines Diliman',
          degree: 'Master of Arts',
          fieldOfStudy: 'Guidance and Counseling',
          startDate: '2015-06',
          endDate: '2017-04',
        },
        {
          institution: 'De La Salle University Manila',
          degree: 'Bachelor of Science',
          fieldOfStudy: 'Psychology',
          startDate: '2011-06',
          endDate: '2015-04',
        },
      ],
      workExperience: [
        {
          company: 'Manila Science High School',
          position: 'School Guidance Counselor',
          startDate: '2019-06',
          endDate: 'Present',
          description:
            'Provide comprehensive guidance services to 800+ students including individual counseling, group sessions, career planning, and crisis intervention. Develop and implement guidance programs aligned with DepEd standards.',
        },
        {
          company: 'Quezon City Science High School',
          position: 'Junior Guidance Counselor',
          startDate: '2017-06',
          endDate: '2019-05',
          description:
            'Assisted senior counselors in providing student support services. Managed student records, facilitated orientation programs, and coordinated with teachers on student welfare matters.',
        },
      ],
      certifications: [
        'Licensed Guidance Counselor (PRC)',
        'NC II Guidance Services',
        'First Aid and CPR Certified',
      ],
      languages: ['Filipino', 'English', 'Japanese (Basic)'],
      totalExperienceYears: 6,
    };

    // Calculate match score based on job requirements
    const requirements = app.job.structuredReqs;
    let matchedCount = 0;
    const matchDetails = requirements.map((req) => {
      let matched = false;
      let confidence: 'high' | 'medium' | 'low' = 'low';
      let evidence = '';

      const reqLower = req.name.toLowerCase();

      // Check skills
      if (req.type === 'SKILL') {
        const found = mockParsedResume.skills.find((s) =>
          s.toLowerCase().includes(reqLower) ||
          reqLower.includes(s.toLowerCase())
        );
        if (found) {
          matched = true;
          confidence = 'high';
          evidence = `Skill found: ${found}`;
        } else {
          // Check work experience
          const expFound = mockParsedResume.workExperience.find(
            (e) =>
              e.position.toLowerCase().includes(reqLower) ||
              e.description.toLowerCase().includes(reqLower)
          );
          if (expFound) {
            matched = true;
            confidence = 'medium';
            evidence = `Related experience: ${expFound.position}`;
          } else {
            evidence = 'Skill not found in resume';
          }
        }
      }
      // Check education
      else if (req.type === 'EDUCATION') {
        const found = mockParsedResume.education.find(
          (e) =>
            e.degree.toLowerCase().includes(reqLower) ||
            e.fieldOfStudy.toLowerCase().includes(reqLower) ||
            reqLower.includes(e.degree.toLowerCase())
        );
        if (found) {
          matched = true;
          confidence = 'high';
          evidence = `${found.degree} in ${found.fieldOfStudy}`;
        } else {
          evidence = 'No matching education found';
        }
      }
      // Check experience
      else if (req.type === 'EXPERIENCE') {
        const yearsMatch = req.name.match(/(\d+)\s*\+?\s*years?/i);
        if (yearsMatch && mockParsedResume.totalExperienceYears) {
          const required = parseInt(yearsMatch[1], 10);
          matched = mockParsedResume.totalExperienceYears >= required;
          confidence = matched ? 'high' : 'medium';
          evidence = matched
            ? `Candidate has ${mockParsedResume.totalExperienceYears} years (requires ${required}+)`
            : `Candidate has ${mockParsedResume.totalExperienceYears} years (requires ${required}+)`;
        }
      }
      // Check certification
      else if (req.type === 'CERTIFICATION') {
        const found = mockParsedResume.certifications.find((c) =>
          c.toLowerCase().includes(reqLower) ||
          reqLower.includes(c.toLowerCase())
        );
        if (found) {
          matched = true;
          confidence = 'high';
          evidence = `Certification found: ${found}`;
        } else {
          evidence = 'Certification not found';
        }
      }
      // Other
      else {
        const allText = [
          ...mockParsedResume.skills,
          ...mockParsedResume.certifications,
          ...mockParsedResume.languages,
          ...mockParsedResume.workExperience.map((w) => `${w.position} ${w.description}`),
          ...mockParsedResume.education.map((e) => `${e.degree} ${e.fieldOfStudy}`),
        ];
        const found = allText.find((t) =>
          t.toLowerCase().includes(reqLower) ||
          reqLower.includes(t.toLowerCase())
        );
        if (found) {
          matched = true;
          confidence = 'medium';
          evidence = `Related: ${found}`;
        } else {
          evidence = 'No match found';
        }
      }

      if (matched) matchedCount++;
      return {
        requirementId: req.id,
        requirementName: req.name,
        requirementType: req.type,
        isRequired: req.isRequired,
        matched,
        confidence,
        evidence,
      };
    });

    // Calculate score
    let totalWeight = 0;
    let matchedWeight = 0;
    for (const d of matchDetails) {
      const weight = d.isRequired ? 2 : 1;
      totalWeight += weight;
      if (d.matched) {
        const mult = d.confidence === 'high' ? 1 : d.confidence === 'medium' ? 0.7 : 0.3;
        matchedWeight += weight * mult;
      }
    }
    const matchScore = totalWeight > 0 ? Math.round((matchedWeight / totalWeight) * 100) : 100;

    console.log(`  Match Score: ${matchScore}% (${matchedCount}/${requirements.length} requirements matched)`);

    // Upsert the parsed resume
    await prisma.parsedResume.upsert({
      where: { documentId: doc.id },
      create: {
        documentId: doc.id,
        rawText: 'Mock resume text for testing purposes...',
        summary: mockParsedResume.summary,
        skills: mockParsedResume.skills,
        education: mockParsedResume.education,
        workExperience: mockParsedResume.workExperience,
        certifications: mockParsedResume.certifications,
        languages: mockParsedResume.languages,
        totalExperienceYears: mockParsedResume.totalExperienceYears,
        matchScore,
        matchDetails: matchDetails as any,
      },
      update: {
        rawText: 'Mock resume text for testing purposes...',
        summary: mockParsedResume.summary,
        skills: mockParsedResume.skills,
        education: mockParsedResume.education,
        workExperience: mockParsedResume.workExperience,
        certifications: mockParsedResume.certifications,
        languages: mockParsedResume.languages,
        totalExperienceYears: mockParsedResume.totalExperienceYears,
        matchScore,
        matchDetails: matchDetails as any,
        parseError: null,
      },
    });

    console.log('  ✓ Parsed resume data saved');
  }

  console.log('\nDone! Mock data seeded successfully.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Error:', e);
  prisma.$disconnect();
  process.exit(1);
});
