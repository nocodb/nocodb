import crypto from 'crypto';

export function randomTokenString(): string {
  return crypto.randomBytes(40).toString('hex');
}

export function utf8ify(str: string): string {
  return Buffer.from(str, 'latin1').toString('utf8');
}

export function swaggerSanitizeSchemaName(name: string) {
  return name.replace(/\W/g, '_');
}
