import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { StorageProvider } from './index';

// Private local storage outside public directory
const STORAGE_DIR = path.join(process.cwd(), 'storage', 'resumes');

async function ensureDirectoryExists() {
  try {
    await fs.access(STORAGE_DIR);
  } catch {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  }
}

export const localStorageProvider: StorageProvider = {
  async upload(fileBuffer: Buffer, fileName: string, mimeType: string, namespace?: string) {
    await ensureDirectoryExists();
    const safeNamespace = namespace?.replace(/[^a-zA-Z0-9_-]/g, '') || '';
    const targetDirectory = safeNamespace ? path.join(STORAGE_DIR, safeNamespace) : STORAGE_DIR;
    await fs.mkdir(targetDirectory, { recursive: true });
    const ext = path.extname(fileName) || '.pdf';
    const hash = crypto.randomBytes(16).toString('hex');
    const storageKey = `${Date.now()}-${hash}${ext}`;
    const filePath = path.join(targetDirectory, storageKey);

    await fs.writeFile(filePath, fileBuffer);
    return { storageKey: safeNamespace ? `${safeNamespace}/${storageKey}` : storageKey };
  },

  async get(storageKey: string) {
    await ensureDirectoryExists();
    // Prevent directory traversal attacks
    const parts = storageKey.split('/').filter(Boolean).map((part) => path.basename(part));
    const sanitizedKey = parts.at(-1) ?? '';
    const filePath = path.join(STORAGE_DIR, ...parts);

    const buffer = await fs.readFile(filePath);
    let contentType = 'application/octet-stream';
    if (sanitizedKey.endsWith('.pdf')) contentType = 'application/pdf';
    else if (sanitizedKey.endsWith('.doc')) contentType = 'application/msword';
    else if (sanitizedKey.endsWith('.docx'))
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    return { buffer, contentType };
  },

  async delete(storageKey: string) {
    await ensureDirectoryExists();
    const parts = storageKey.split('/').filter(Boolean).map((part) => path.basename(part));
    const filePath = path.join(STORAGE_DIR, ...parts);
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore if file already deleted
    }
  },
};
