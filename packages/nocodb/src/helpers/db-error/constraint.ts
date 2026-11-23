export type ConstraintViolationType = 'check' | 'foreign_key' | 'too_long';

/** A CHECK / foreign-key / length violation, with the physical names the driver reports. */
export interface ConstraintViolation {
  type: ConstraintViolationType;
  /** Physical column, when the driver names it. */
  column?: string;
  /** Constraint name, or for unnamed SQLite CHECKs the expression. */
  constraint?: string;
  /** Table the violation is on, when the driver names it. */
  table?: string;
  /** Offending value, when the driver reports it. */
  value?: string;
  /** sqlite: `constraint` may be the CHECK's expression rather than a name. */
  mayBeExpression?: boolean;
}

const SQLITE_PREFIX = 'SQLITE_CONSTRAINT: ';

/** The driver's own message, without the `<sql> - ` prefix knex adds. */
export function driverMessage(error: any): string {
  if (typeof error?.sqlMessage === 'string') return error.sqlMessage;
  const message = typeof error?.message === 'string' ? error.message : '';
  // sqlite: the driver text follows the query, so take the last occurrence
  const idx = message.lastIndexOf(SQLITE_PREFIX);
  return idx >= 0 ? message.slice(idx + SQLITE_PREFIX.length) : message;
}

/**
 * Parses a CHECK, foreign-key (missing referenced row) or value-too-long
 * violation from a pg / mysql / mariadb / sqlite driver error.
 */
export function parseConstraintViolation(
  error: any,
): ConstraintViolation | undefined {
  if (!error || typeof error !== 'object' || error.code === undefined) return;
  const code = String(error.code);

  // pg
  if (code === '23514') {
    return {
      type: 'check',
      constraint: error.constraint,
      table: error.table,
    };
  }
  if (code === '23503') {
    const detail: string = error.detail || '';
    if (!/is not present/i.test(detail)) return;
    const match = detail.match(/Key \((.+?)\)=\((.*)\) is not present/);
    return {
      type: 'foreign_key',
      constraint: error.constraint,
      table: error.table,
      column: match?.[1]?.includes(',')
        ? undefined
        : match?.[1]?.replace(/^"|"$/g, ''),
      value: match?.[1]?.includes(',') ? undefined : match?.[2],
    };
  }
  if (code === '22001') return { type: 'too_long' };

  // mysql / mariadb
  if (code.startsWith('ER_') || typeof error.errno === 'number') {
    const message = driverMessage(error);
    if (code === 'ER_CHECK_CONSTRAINT_VIOLATED' || error.errno === 3819) {
      const constraint = message.match(
        /Check constraint '(.+)' is violated/,
      )?.[1];
      if (constraint) return { type: 'check', constraint };
    }
    // mariadb ER_CONSTRAINT_FAILED (4025); mysql2 maps 4025 to another name
    if (error.errno === 4025) {
      const match = message.match(
        /CONSTRAINT `(.+)` failed for `[^`]*`\.`([^`]+)`/,
      );
      if (match)
        return { type: 'check', constraint: match[1], table: match[2] };
    }
    if (code === 'ER_NO_REFERENCED_ROW_2' || code === 'ER_NO_REFERENCED_ROW') {
      const match = message.match(
        /foreign key constraint fails \(`[^`]*`\.`([^`]+)`, CONSTRAINT `([^`]+)` FOREIGN KEY \(([^)]+)\)/,
      );
      const columns = match?.[3]?.split(',');
      return {
        type: 'foreign_key',
        table: match?.[1],
        constraint: match?.[2],
        column:
          columns?.length === 1
            ? columns[0].trim().replace(/`/g, '')
            : undefined,
      };
    }
    if (code === 'ER_DATA_TOO_LONG') {
      return {
        type: 'too_long',
        column: message.match(/Data too long for column '([^']+)'/)?.[1],
      };
    }
  }

  // sqlite
  if (code === 'SQLITE_CONSTRAINT') {
    const message = driverMessage(error);
    const check = message.match(/^CHECK constraint failed: (.+)$/s)?.[1];
    if (check)
      return { type: 'check', constraint: check.trim(), mayBeExpression: true };
    if (/^FOREIGN KEY constraint failed/.test(message)) {
      return { type: 'foreign_key' };
    }
  }
}

/**
 * Message for a constraint violation, naming the field when known and the
 * constraint otherwise.
 */
export function constraintViolationMessage(
  violation: ConstraintViolation,
  field?: string,
): string {
  const subject = field ? `Field '${field}'` : 'This record';
  switch (violation.type) {
    case 'check':
      return violation.constraint
        ? `${subject} does not satisfy the check constraint '${violation.constraint}'.`
        : `${subject} does not satisfy a check constraint.`;
    case 'foreign_key': {
      const ref =
        field && violation.value !== undefined
          ? ` (value '${violation.value}')`
          : !field && violation.constraint
          ? ` (foreign key '${violation.constraint}')`
          : '';
      return `${subject} references a record that does not exist${ref}.`;
    }
    case 'too_long':
      return field
        ? `The value for field '${field}' is too long.`
        : 'The data entered is too long for this field.';
  }
}
