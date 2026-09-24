import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { del, get, put } from '@vercel/blob';
import type { StorageProvider } from './index';

function requireBlobToken() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('BLOB_READ_WRITE_TOKEN is required for persistent file storage on Vercel.');
  }
}

export const vercelBlobStorageProvider: StorageProvider = {
  async upload(fileBuffer, fileName, mimeType, namespace) {
    requireBlobToken();
    const safeNamespace = namespace?.replace(/[^a-zA-Z0-9_-]/g, '') || 'documents';
    const extension = path.extname(fileName).replace(/[^a-zA-Z0-9.]/g, '') || '.bin';
    const pathname = `workpulse/${safeNamespace}/${Date.now()}-${randomUUID()}${extension}`;
    const blob = await put(pathname, fileBuffer, { access: 'private', contentType: mimeType, addRandomSuffix: false });
    return { storageKey: blob.pathname };
  },

  async get(storageKey) {
    requireBlobToken();
    const result = await get(storageKey, { access: 'private' });
    if (!result || result.statusCode !== 200 || !result.stream) throw new Error('Stored file not found.');
    const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
    return { buffer, contentType: result.blob.contentType || 'application/octet-stream' };
  },

  async delete(storageKey) {
    requireBlobToken();
    await del(storageKey);
  },
};
