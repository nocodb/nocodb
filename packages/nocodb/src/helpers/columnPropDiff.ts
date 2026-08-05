import type { ColumnReqType } from 'nocodb-sdk';
import type { Column } from '~/models';

/**
 * Props declared as `table.boolean(...)` on `nc_columns`.
 *
 * Knex persists these as 0/1 on SQLite/MySQL and as a native boolean on
 * Postgres, and API clients send either form, so they are compared on
 * truthiness rather than identity.
 */
const BOOLEAN_COLUMN_PROPS = new Set([
  'ai',
  'au',
  'deleted',
  'pk',
  'pv',
  'readonly',
  'rqd',
  'system',
  'un',
  'unique',
  'virtual',
]);

/**
 * Does `payload` actually change `prop` on `storedColumn`?
 *
 * A column PATCH is a partial update: a prop that is absent means "leave
 * unchanged", and a prop submitted with the value the column already holds is
 * a no-op. Guards that ask "is the client modifying this column?" must ask it
 * of the submitted *values*, not of the payload's key set — otherwise echoing
 * a column's own title back at it reads as a rename.
 *
 * Deliberately conservative: it reports a modification whenever the two values
 * cannot be shown to be equivalent (objects, mismatched null-ness). Callers use
 * it to relax a guard, so a false "modified" only preserves existing strictness
 * while a false "unmodified" would let a real change slip past.
 */
export function isColumnPropModified(
  storedColumn: Column | Record<string, any>,
  payload: ColumnReqType | Record<string, any>,
  prop: string,
): boolean {
  // absent from the payload means "leave unchanged", never "clear"
  if (!(prop in payload)) return false;

  const submitted = payload[prop];
  const stored = storedColumn?.[prop];

  if (BOOLEAN_COLUMN_PROPS.has(prop)) {
    return !!submitted !== !!stored;
  }

  // null and undefined both read as "no value" in column meta
  const submittedIsEmpty = submitted === null || submitted === undefined;
  const storedIsEmpty = stored === null || stored === undefined;
  if (submittedIsEmpty || storedIsEmpty) {
    return submittedIsEmpty !== storedIsEmpty;
  }

  // Structured props (colOptions, column_order, ...) have no cheap comparison
  // that is trustworthy across the shapes clients send, so treat them as
  // modified and leave the guard exactly as strict as it was before.
  if (typeof submitted === 'object' || typeof stored === 'object') {
    return true;
  }

  // Meta is stored as text, so a numeric `255` and a string `'255'` land on
  // the same stored value.
  return String(submitted) !== String(stored);
}

/**
 * Do any of `payload`'s props outside `ignoredProps` actually change
 * `storedColumn`?
 */
export function payloadModifiesColumn(
  storedColumn: Column | Record<string, any>,
  payload: ColumnReqType | Record<string, any>,
  ignoredProps: Set<string>,
): boolean {
  return Object.keys(payload).some(
    (prop) =>
      !ignoredProps.has(prop) &&
      isColumnPropModified(storedColumn, payload, prop),
  );
}
