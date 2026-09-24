export interface StorageProvider {
  upload(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string,
    namespace?: string
  ): Promise<{ storageKey: string }>;
  
  get(storageKey: string): Promise<{ buffer: Buffer; contentType: string }>;

  delete(storageKey: string): Promise<void>;
}

import { fileSystemStorageProvider } from './localStorage';
import { vercelBlobStorageProvider } from './vercelBlob';

// Preserve the established import name while selecting durable storage on Vercel.
// Local development continues to use private files under ./storage.
export const localStorageProvider = process.env.VERCEL === '1' || process.env.BLOB_READ_WRITE_TOKEN
  ? vercelBlobStorageProvider
  : fileSystemStorageProvider;
