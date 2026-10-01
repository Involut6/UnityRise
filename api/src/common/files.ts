/** Detects the real type from magic bytes; never trust the client-supplied filename or MIME type. */
export type FileKind = { ext: 'jpg' | 'png' | 'pdf'; mime: string };

export function sniffFile(b: Buffer): FileKind | undefined {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  if (b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png' };
  if (b.length >= 5 && b.subarray(0, 5).toString('latin1') === '%PDF-') return { ext: 'pdf', mime: 'application/pdf' };
  return undefined;
}

/** Max upload size. Base64 inflates by 4/3 and Vercel rejects request bodies over 4.5MB, so 3MB keeps every host working. */
export const MAX_FILE = 3 * 1024 * 1024;
