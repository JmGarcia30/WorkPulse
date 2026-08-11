export interface StorageProvider {
  upload(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<{ storageKey: string }>;
  
  get(storageKey: string): Promise<{ buffer: Buffer; contentType: string }>;

  delete(storageKey: string): Promise<void>;
}

export { localStorageProvider } from './localStorage';
