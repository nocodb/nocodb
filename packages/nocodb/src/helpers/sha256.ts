import { createHash, timingSafeEqual } from 'crypto';

export const sha256Hex = (value: string) =>
  createHash('sha256').update(value, 'utf8').digest('hex');

// Compares digests so neither length nor content leaks through timing.
export const secretEquals = (a: string, b: string) =>
  typeof a === 'string' &&
  typeof b === 'string' &&
  timingSafeEqual(
    createHash('sha256').update(a, 'utf8').digest(),
    createHash('sha256').update(b, 'utf8').digest(),
  );
