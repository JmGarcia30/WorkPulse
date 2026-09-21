const TYPES = {
  'image/png': { extension: '.png', signature: (b: Buffer) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
  'image/jpeg': { extension: '.jpg', signature: (b: Buffer) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/webp': { extension: '.webp', signature: (b: Buffer) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
} as const;

export function validateBrandImage(file: File, maxBytes: number) {
  if (file.size === 0 || file.size > maxBytes) throw new Error(`Image must be smaller than ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  const type = TYPES[file.type as keyof typeof TYPES];
  if (!type) throw new Error('Use a PNG, JPEG, or WebP image.');
  return file.arrayBuffer().then((value) => {
    const buffer = Buffer.from(value);
    if (!type.signature(buffer)) throw new Error('The file contents do not match the selected image type.');
    return { buffer, mimeType: file.type, fileName: `brand${type.extension}` };
  });
}
