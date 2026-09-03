// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse/lib/pdf-parse.js');
import mammoth from 'mammoth';

export type ExtractionStatus =
  | 'SUCCESS'
  | 'EMPTY'
  | 'CORRUPT'
  | 'UNSUPPORTED'
  | 'ERROR';

export interface ExtractionResult {
  text: string;
  charCount: number;
  wordCount: number;
  meaningfulCharCount: number;
  sourceType: 'PDF' | 'DOCX';
  extractionStatus: ExtractionStatus;
  warning?: string;
  error?: string;
}

/**
 * Normalize extracted text:
 * - Remove null bytes and unprintable control characters
 * - Normalize unicode whitespace
 * - Collapse excessive spaces and tabs
 * - Normalize excessive blank lines while preserving paragraphs and line breaks
 * - Preserve bullets, hyphens, and list markers
 */
export function normalizeExtractedText(raw: string): string {
  if (!raw) return '';
  return raw
    // Remove null bytes and control characters (except tab 0x09 and newline 0x0A)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize unicode whitespace characters to regular space
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF]/g, ' ')
    // Normalize line endings to LF
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Normalize multiple horizontal spaces/tabs to single space
    .replace(/[ \t]+/g, ' ')
    // Collapse 3+ consecutive newlines to 2 newlines (preserve paragraph breaks)
    .replace(/\n{3,}/g, '\n\n')
    // Trim each line
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

/**
 * Evaluate extraction quality to detect empty, whitespace-only, or scanned/image-based files.
 */
export function evaluateExtractionQuality(
  normalizedText: string,
  sourceType: 'PDF' | 'DOCX'
): {
  charCount: number;
  wordCount: number;
  meaningfulCharCount: number;
  status: ExtractionStatus;
  warning?: string;
} {
  const charCount = normalizedText.length;
  const words = normalizedText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Count alphanumeric characters (letters and digits)
  const meaningfulChars = normalizedText.match(/[a-zA-Z0-9]/g) || [];
  const meaningfulCharCount = meaningfulChars.length;

  // If text is empty or has virtually no alphanumeric content (< 20 chars or < 5 words)
  if (charCount === 0 || meaningfulCharCount < 20 || wordCount < 5) {
    return {
      charCount,
      wordCount,
      meaningfulCharCount,
      status: 'EMPTY',
      warning:
        sourceType === 'PDF'
          ? 'Could not extract readable text from this resume. The PDF may be scanned, image-based, or empty.'
          : 'Could not extract readable text from this document. The file may be empty or contain only images.',
    };
  }

  return {
    charCount,
    wordCount,
    meaningfulCharCount,
    status: 'SUCCESS',
  };
}

/**
 * Categorize PDF errors thrown by pdf.js / pdf-parse.
 */
function categorizePdfError(err: unknown): {
  status: ExtractionStatus;
  warning: string;
  error: string;
} {
  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : '';
  const lowerMsg = message.toLowerCase();

  // Password / encrypted
  if (
    name === 'PasswordException' ||
    lowerMsg.includes('password') ||
    lowerMsg.includes('encrypted')
  ) {
    return {
      status: 'UNSUPPORTED',
      warning:
        'This PDF is password-protected or encrypted and cannot be parsed.',
      error: message,
    };
  }

  // Corrupt / bad xref / invalid structure / format error
  if (
    name === 'InvalidPDFException' ||
    name === 'FormatError' ||
    lowerMsg.includes('bad xref') ||
    lowerMsg.includes('xref') ||
    lowerMsg.includes('invalid pdf') ||
    lowerMsg.includes('corrupt') ||
    lowerMsg.includes('damaged') ||
    lowerMsg.includes('truncated')
  ) {
    return {
      status: 'CORRUPT',
      warning:
        'Unable to extract readable text from this PDF. The file may be corrupted or contain an unsupported PDF structure.',
      error: message,
    };
  }

  // General error
  return {
    status: 'ERROR',
    warning: `Failed to extract text from PDF: ${message}`,
    error: message,
  };
}

/**
 * Extract plain text content from a PDF buffer with buffer isolation,
 * xref recovery handling, and quality validation.
 */
export async function extractTextFromPDF(
  buffer: Buffer
): Promise<ExtractionResult> {
  // CRITICAL: Allocate an isolated typed array copy to prevent mutable Node Buffer pool corruption in pdf.js
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(buffer);

  try {
    const result = await pdfParse(bytes);
    const rawText = typeof result?.text === 'string' ? result.text : '';
    const normalized = normalizeExtractedText(rawText);
    const quality = evaluateExtractionQuality(normalized, 'PDF');

    return {
      text: quality.status === 'SUCCESS' ? normalized : '',
      charCount: quality.charCount,
      wordCount: quality.wordCount,
      meaningfulCharCount: quality.meaningfulCharCount,
      sourceType: 'PDF',
      extractionStatus: quality.status,
      warning: quality.warning,
    };
  } catch (err) {
    const errorDetails = categorizePdfError(err);
    console.error(
      `[PDF Extraction Error] Status: ${errorDetails.status} | Details: ${errorDetails.error}`
    );
    return {
      text: '',
      charCount: 0,
      wordCount: 0,
      meaningfulCharCount: 0,
      sourceType: 'PDF',
      extractionStatus: errorDetails.status,
      warning: errorDetails.warning,
      error: errorDetails.error,
    };
  }
}

/**
 * Extract plain text content from a DOCX buffer.
 */
export async function extractTextFromDOCX(
  buffer: Buffer
): Promise<ExtractionResult> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const rawText = typeof result?.value === 'string' ? result.value : '';
    const normalized = normalizeExtractedText(rawText);
    const quality = evaluateExtractionQuality(normalized, 'DOCX');

    return {
      text: quality.status === 'SUCCESS' ? normalized : '',
      charCount: quality.charCount,
      wordCount: quality.wordCount,
      meaningfulCharCount: quality.meaningfulCharCount,
      sourceType: 'DOCX',
      extractionStatus: quality.status,
      warning: quality.warning,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[DOCX Extraction Error] Details: ${message}`);
    return {
      text: '',
      charCount: 0,
      wordCount: 0,
      meaningfulCharCount: 0,
      sourceType: 'DOCX',
      extractionStatus: 'ERROR',
      warning: `Failed to extract text from DOCX document: ${message}`,
      error: message,
    };
  }
}

/**
 * Extract text from a resume file buffer based on its MIME type.
 */
export async function extractResumeText(
  buffer: Buffer,
  mimeType: string
): Promise<ExtractionResult> {
  switch (mimeType) {
    case 'application/pdf':
      return extractTextFromPDF(buffer);
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return extractTextFromDOCX(buffer);
    default:
      return {
        text: '',
        charCount: 0,
        wordCount: 0,
        meaningfulCharCount: 0,
        sourceType: 'PDF',
        extractionStatus: 'UNSUPPORTED',
        warning: `Unsupported file type: ${mimeType}. Only PDF and DOCX files are supported for resume parsing.`,
        error: `Unsupported MIME type: ${mimeType}`,
      };
  }
}

