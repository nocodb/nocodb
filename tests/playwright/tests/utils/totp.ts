import { createHmac } from 'crypto';

/**
 * RFC 6238 TOTP — minimal implementation against Node's built-in
 * `crypto.createHmac`. Matches the parameters the backend uses
 * (`otplib` defaults: SHA-1, 30s step, 6-digit code, base32 secret).
 *
 * Kept in-tree to avoid adding a new dependency to the playwright
 * package just for tests. See packages/nocodb/src/ee/services/mfa.service.ts
 * for the verification side.
 */

// RFC 4648 base32 — alphabet matches `thirty-two`/`otplib`.
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase();
  const bits: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) {
      throw new Error(`Invalid base32 character: ${ch}`);
    }
    for (let i = 4; i >= 0; i--) bits.push((idx >> i) & 1);
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    bytes.push(b);
  }
  return Buffer.from(bytes);
}

/**
 * Generate a 6-digit TOTP code for the supplied base32 secret.
 *
 * @param secret base32-encoded shared secret (as returned by `/auth/mfa/setup`)
 * @param when   optional Date to use as "now" — defaults to current wall clock
 */
export function generateTotp(secret: string, when: Date = new Date()): string {
  const stepSeconds = 30;
  const counter = Math.floor(when.getTime() / 1000 / stepSeconds);

  // 8-byte big-endian counter. JS bit-shifts go through int32 so we
  // build the buffer via BigInt to be safe across the full 64-bit space.
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter), 0);

  const key = base32Decode(secret);
  const hmac = createHmac('sha1', key).update(counterBuf).digest();

  // Dynamic truncation (RFC 4226 §5.4)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const code = binary % 1_000_000;
  return code.toString().padStart(6, '0');
}
