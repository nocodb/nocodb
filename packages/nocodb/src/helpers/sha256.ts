import { createHash } from 'crypto';

export const sha256Hex = (value: string) =>
  createHash('sha256').update(value, 'utf8').digest('hex');
