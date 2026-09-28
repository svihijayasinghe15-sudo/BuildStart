import crypto from 'crypto';

/**
 * Computes SHA-256 hash of a base64 or buffer string
 */
export function computeSha256(data: string | Buffer): string {
  let buffer: Buffer;
  if (Buffer.isBuffer(data)) {
    buffer = data;
  } else if (data.startsWith('data:')) {
    // Strip data URI header
    const commaIndex = data.indexOf(',');
    const base64Data = commaIndex !== -1 ? data.slice(commaIndex + 1) : data;
    buffer = Buffer.from(base64Data, 'base64');
  } else {
    buffer = Buffer.from(data, 'utf-8');
  }

  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Computes a lightweight structural / normalized signature
 * to detect duplicated uploads even across basic re-encodings.
 */
export function computePerceptualSignature(data: string): string {
  try {
    const raw = data.slice(0, 1000) + data.slice(-1000);
    return crypto.createHash('md5').update(raw).digest('hex');
  } catch {
    return computeSha256(data).slice(0, 16);
  }
}
