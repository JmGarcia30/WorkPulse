import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

export const MAX_CSV_ROWS = 10000;
export const MAX_PDF_ROWS = 1000;

export function csvCell(value: unknown): string {
  const clean = String(value ?? '').replace(/[\r\n\t\u0000-\u001f\u007f]/g, ' ');
  // Quotes alone do not stop spreadsheet formula execution.
  const safe = /^\s*[=+\-@]/.test(clean) ? "'" + clean : clean;
  return '"' + safe.replace(/"/g, '""') + '"';
}

export function csvDocument(headers: string[], rows: unknown[][]): string {
  return '\uFEFF' + [headers.map(csvCell).join(','), ...rows.map(row => row.map(csvCell).join(','))].join('\r\n') + '\r\n';
}

export function fileResponse(body: string | Uint8Array, fileName: string, format: 'csv' | 'pdf') {
  const contentType = format === 'csv' ? 'text/csv; charset=utf-8' : 'application/pdf';
  return new Response(body instanceof Uint8Array ? new Uint8Array(body) : body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': 'attachment; filename="' + fileName + '"',
      'Cache-Control': 'private, no-store, max-age=0',
      'Vary': 'Cookie',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export type PdfSection = { heading: string; lines: string[] };
export type PdfReport = { title: string; organization: string; period: string; sections: PdfSection[] };

function pdfText(value: string): string {
  // Built-in Helvetica cannot render arbitrary Unicode, so sanitize unsupported glyphs.
  return value.normalize('NFKD').replace(/[\r\n\t]/g, ' ').replace(/[^\x20-\x7e]/g, '?').slice(0, 2000);
}

export async function pdfDocument(report: PdfReport): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const width = 595.28;
  const height = 841.89;
  const left = 46;
  const right = 46;
  const usableWidth = width - left - right;
  let page: PDFPage;
  let y = height - 44;
  let pageNumber = 0;

  function newPage() {
    page = doc.addPage([width, height]);
    pageNumber += 1;
    y = height - 44;
    page.drawText('WORKPULSE  /  HR REPORT', { x: left, y, size: 9, font: bold, color: rgb(0.28, 0.35, 0.47) });
    page.drawLine({ start: { x: left, y: y - 11 }, end: { x: width - right, y: y - 11 }, thickness: 0.7, color: rgb(0.75, 0.78, 0.83) });
    page.drawText('Page ' + pageNumber, { x: width - right - 50, y: 28, size: 9, font: regular, color: rgb(0.4, 0.45, 0.52) });
    y -= 34;
  }
  function wrap(text: string, font: PDFFont, size: number): string[] {
    const words = pdfText(text).split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const next = current ? current + ' ' + word : word;
      if (font.widthOfTextAtSize(next, size) <= usableWidth) { current = next; continue; }
      if (current) { lines.push(current); current = ''; }
      // Break long identifiers rather than drawing beyond the page edge.
      for (const character of word) {
        if (font.widthOfTextAtSize(current + character, size) > usableWidth && current) {
          lines.push(current);
          current = '';
        }
        current += character;
      }
    }
    if (current || !lines.length) lines.push(current);
    return lines;
  }
  function write(text: string, opts: { bold?: boolean; size?: number; gap?: number } = {}) {
    const font = opts.bold ? bold : regular;
    const size = opts.size ?? 10;
    const leading = size + 5;
    for (const line of wrap(text, font, size)) {
      if (y < 62 + leading) newPage();
      page.drawText(line, { x: left, y, size, font, color: rgb(0.12, 0.17, 0.24) });
      y -= leading;
    }
    y -= opts.gap ?? 2;
  }
  newPage();
  write(report.title, { bold: true, size: 18, gap: 9 });
  write('Organization: ' + report.organization, { size: 10 });
  write('Period: ' + report.period, { size: 10 });
  write('Generated: ' + new Date().toISOString(), { size: 9, gap: 16 });
  for (const section of report.sections) {
    if (y < 115) newPage();
    write(section.heading, { bold: true, size: 12, gap: 7 });
    for (const line of section.lines) write(line, { size: 9, gap: 2 });
    y -= 10;
  }
  return doc.save();
}
