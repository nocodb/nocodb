// pg (NAMEDATALEN) and Oracle cap identifiers in bytes, the rest in characters.
export function getIdentifierLength(
  name: string,
  sqlClientType?: string,
): number {
  if (sqlClientType === 'pg' || sqlClientType === 'oracledb') {
    return Buffer.byteLength(name, 'utf8');
  }
  return name.length;
}

// Cuts by code point so a multibyte or astral character is never split.
export function truncateIdentifier(
  name: string,
  limit: number,
  sqlClientType?: string,
): string {
  if (getIdentifierLength(name, sqlClientType) <= limit) return name;
  const chars = Array.from(name);
  while (
    chars.length &&
    getIdentifierLength(chars.join(''), sqlClientType) > limit
  ) {
    chars.pop();
  }
  return chars.join('');
}

// "bytes" only when that differs from the character count, so an ASCII name
// keeps the existing message.
export function getIdentifierLengthUnit(
  name: string,
  sqlClientType?: string,
): 'bytes' | 'characters' {
  return getIdentifierLength(name, sqlClientType) !== name.length
    ? 'bytes'
    : 'characters';
}
