import { UITypes } from 'nocodb-sdk';
import type { ColumnType } from 'nocodb-sdk';

/**
 * Group key of a parsed row value or grouping value, so the two compare
 * equal: user ids for a user field, a string for a number or boolean (e.g. a
 * link's foreign key) or a date, empty values as null. Other values are kept
 * as they are, so they never land in the empty group.
 */
export function groupKeyOf(
  column: Pick<ColumnType, 'uidt'>,
  value: unknown,
): unknown {
  if (value === '' || value === undefined || value === null) return null;

  if (column.uidt === UITypes.User) {
    const users = Array.isArray(value) ? value : [value];
    const ids = users
      .map((u) => (typeof u === 'object' ? u?.id : u))
      .filter(Boolean);
    return ids.length ? ids.join(',') : null;
  }

  if (typeof value === 'string') return value;

  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);

  if (value instanceof Date) return value.toISOString();

  return value;
}

/** Grouped-list keys of one group: a numeric key counts under its string form. */
export function isSameGroupKey(a: unknown, b: unknown) {
  if (a === null || a === undefined || b === null || b === undefined)
    return (a ?? null) === (b ?? null);
  return `${a}` === `${b}`;
}
