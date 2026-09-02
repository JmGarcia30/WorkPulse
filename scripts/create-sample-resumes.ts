import fs from 'fs/promises';
import path from 'path';

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'resumes');

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * Create a standard, fully-valid PDF with multi-line text content using pdf-lib.
 */
async function createPDF(text: string): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([612, 792]);

  const lines = text.split('\n');
  let y = 740;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      y -= 8;
      continue;
    }
    if (trimmed.startsWith('# ')) {
      page.drawText(trimmed.replace(/^#\s*/, ''), {
        x: 50,
        y,
        size: 18,
        font: boldFont,
        color: rgb(0.1, 0.1, 0.1),
      });
      y -= 24;
    } else if (trimmed.startsWith('## ')) {
      page.drawText(trimmed.replace(/^##\s*/, ''), {
        x: 50,
        y,
        size: 13,
        font: boldFont,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= 18;
    } else {
      page.drawText(trimmed.substring(0, 95), {
        x: 50,
        y,
        size: 10,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
      y -= 14;
    }
  }

  const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
  return Buffer.from(pdfBytes);
}

const carlosResume = `# Carlos Mendoza

## Contact Information
Email: carlos.mendoza@gmail.com
Phone: +63 917 555 0123
Address: Quezon City, Metro Manila, Philippines

## Professional Summary
Experienced Senior STEM Educator with over 5 years of professional experience in educational institutions. Strong background in curriculum development, student guidance, and academic administration. Demonstrated ability to work collaboratively with faculty, staff, and administration to achieve institutional goals.

## Education
Master of Arts in Guidance and Counseling
University of the Philippines Diliman
2015-06 to 2017-04

Bachelor of Science in Psychology
De La Salle University Manila
2011-06 to 2015-04

## Work Experience
School Guidance Counselor
Manila Science High School
2019-06 to Present
Provide comprehensive guidance services to 800+ students including individual counseling, group sessions, career planning, and crisis intervention. Develop and implement guidance programs aligned with DepEd standards.

Junior Guidance Counselor
Quezon City Science High School
2017-06 to 2019-05
Assisted senior counselors in providing student support services. Managed student records, facilitated orientation programs, and coordinated with teachers on student welfare matters.

## Skills
Student Counseling, Career Guidance, Academic Advising, Crisis Intervention, Microsoft Office, Google Workspace, Data Analysis, Report Writing, Group Facilitation, Parent Communication, IEP Development, Behavioral Assessment

## Certifications
Licensed Guidance Counselor (PRC)
NC II Guidance Services
First Aid and CPR Certified

## Languages
Filipino, English, Japanese (Basic)`;

const anaResume = `# Ana Reyes

## Contact Information
Email: ana.reyes@yahoo.com
Phone: +63 918 765 4321
Address: Manila, Metro Manila, Philippines

## Professional Summary
Dedicated School Guidance Counselor with 4 years of experience in student development and welfare. Expertise in career counseling, psychological assessment, and implementing DepEd guidance programs. Passionate about helping students achieve their academic and personal goals.

## Education
Master of Arts in Counseling Psychology
Ateneo de Manila University
2016-06 to 2018-04

Bachelor of Arts in Psychology
University of Santo Tomas
2012-06 to 2016-04

## Work Experience
Guidance Counselor
Pasig City Science High School
2018-06 to Present
Deliver individual and group counseling sessions to 600+ students. Administer psychological assessments and develop intervention plans. Coordinate with parents and teachers on student welfare concerns.

Student Intern
Manila Division Guidance Center
2017-06 to 2018-05
Assisted in conducting career orientation seminars and psychological testing. Maintained student records and facilitated peer counseling programs.

## Skills
Guidance Counseling, Psychological Assessment, Career Development, Student Welfare, Conflict Resolution, Parent Conferences, DepEd Programs, Microsoft Office, Google Workspace

## Certifications
Licensed Guidance Counselor (PRC)
National Certificate II in Guidance Services

## Languages
Filipino, English, Mandarin (Basic)`;

async function main() {
  await fs.mkdir(STORAGE_DIR, { recursive: true });

  // Create Carlos Mendoza's resume
  const carlosPDF = await createPDF(carlosResume);
  const carlosPath = path.join(STORAGE_DIR, 'seed-carlos-mendoza-cv.pdf');
  await fs.writeFile(carlosPath, carlosPDF);
  console.log(`✓ Created: ${carlosPath} (${carlosPDF.length} bytes)`);

  // Create Ana Reyes' resume
  const anaPDF = await createPDF(anaResume);
  const anaPath = path.join(STORAGE_DIR, 'seed-ana-reyes-resume.pdf');
  await fs.writeFile(anaPath, anaPDF);
  console.log(`✓ Created: ${anaPath} (${anaPDF.length} bytes)`);

  console.log('\nSample resumes created successfully!');
}

main().catch((e) => {
  console.error('Error:', e);
  process.exit(1);
});
