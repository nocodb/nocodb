// import at top
import { createHash } from 'crypto';

/**
 * Computes MD5 checksum of a string representation of the input.
 * @param input any value – will be coerced to string.
 */
export function checksum_md5(input: any): string | null {
  if (input == null) return null;
  return createHash('md5').update(String(input), 'utf8').digest('hex');
}

/**
 * Computes SHA-1 checksum of a string representation of the input.
 */
export function checksum_sha1(input: any): string | null {
  if (input == null) return null;
  return createHash('sha1').update(String(input), 'utf8').digest('hex');
}

/**
 * Computes SHA-256 checksum of a string representation of the input.
 */
export function checksum_sha256(input: any): string | null {
  if (input == null) return null;
  return createHash('sha256').update(String(input), 'utf8').digest('hex');
}
