/**
 * Table-name limits are not all counted the same way.
 * PostgreSQL's NAMEDATALEN and Oracle's identifier limit are UTF-8 bytes.
 * MySQL (64) and SQL Server (128, stored as nvarchar) are characters, which
 * this codebase has always measured with UTF-16 code units (`.length`).
 */
export function tableNameLimitIsBytes(sqlClientType: string): boolean {
  return sqlClientType === 'pg' || sqlClientType === 'oracledb';
}

export function measureTableName(name: string, sqlClientType: string): number {
  return tableNameLimitIsBytes(sqlClientType)
    ? Buffer.byteLength(name, 'utf8')
    : name.length;
}

export function tableNameTooLongMessage(
  limit: number,
  sqlClientType: string,
): string {
  const unit = tableNameLimitIsBytes(sqlClientType) ? 'bytes' : 'characters';
  return `Table name exceeds ${limit} ${unit}`;
}

/**
 * `<base><suffix>` for a physical name that is already taken.
 * A requested name that is already over the limit is returned untrimmed so
 * the caller's length check rejects it instead of silently shortening it.
 * The cut is on a code point: pg/oracledb stop before a character would
 * cross the byte budget, and other dialects keep the historical
 * `Array.from` slice so an astral character is never split.
 */
export function physicalTableNameCandidate(
  desired: string,
  suffix: string,
  maxLength: number | undefined,
  sqlClientType: string,
): string {
  const overLimit =
    maxLength !== undefined &&
    measureTableName(desired, sqlClientType) > maxLength;
  if (overLimit || maxLength === undefined) {
    return `${desired}${suffix}`;
  }

  if (!tableNameLimitIsBytes(sqlClientType)) {
    const base = Array.from(desired)
      .slice(0, maxLength - suffix.length)
      .join('');
    return `${base}${suffix}`;
  }

  const budget = maxLength - Buffer.byteLength(suffix, 'utf8');
  let base = '';
  for (const ch of desired) {
    const next = base + ch;
    if (Buffer.byteLength(next, 'utf8') > budget) break;
    base = next;
  }
  return `${base}${suffix}`;
}
