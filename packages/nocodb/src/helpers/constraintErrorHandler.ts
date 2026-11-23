import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { ConstraintViolation } from '~/helpers/db-error/constraint';
import type Column from '~/models/Column';
import {
  constraintViolationMessage,
  parseConstraintViolation,
} from '~/helpers/db-error/constraint';
import { DBErrorExtractor } from '~/helpers/db-error/extractor';
import { ExtractedDbError } from '~/helpers/db-error/utils';
import { handleNotNullConstraintError } from '~/helpers/notNullConstraintErrorHandler';

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The column a CHECK / foreign-key / length violation is on: the one the
 * driver names, else one derived from the constraint name or expression.
 */
export function resolveViolatedColumn(
  violation: ConstraintViolation,
  columns: Pick<Column, 'column_name' | 'title'>[],
  tableName?: string,
) {
  const physical = columns.filter((c) => c.column_name);
  const byName = (name: string) =>
    physical.find((c) => c.column_name === name) ??
    physical.find((c) => c.column_name.toLowerCase() === name.toLowerCase());

  if (violation.column) return byName(violation.column);

  const name = violation.constraint;
  if (!name) return;

  // mariadb names a column-level CHECK after its column
  const exact = byName(name);
  if (exact) return exact;

  // pg default names: <table>_<column>_check / <table>_<column>_fkey
  const prefix = `${tableName}_`.toLowerCase();
  const pgDefault = name.match(/^(.+)_(?:check|fkey)$/)?.[1];
  if (tableName && pgDefault?.toLowerCase().startsWith(prefix)) {
    const column = byName(pgDefault.slice(prefix.length));
    if (column) return column;
  }

  // sqlite reports an unnamed CHECK by its expression: use the one column it mentions
  const mentioned = physical.filter((c) =>
    new RegExp(`(^|\\W)${escapeRegExp(c.column_name)}(\\W|$)`).test(name),
  );
  return mentioned.length === 1 ? mentioned[0] : undefined;
}

/**
 * Rethrows a driver constraint violation (not-null, CHECK, foreign key, value
 * too long) naming the field by its title. No-op when the field can't be
 * told, so the caller rethrows the original and the db error mapper names the
 * constraint instead.
 */
export async function handleConstraintError({
  error,
  baseModel,
}: {
  error: any;
  baseModel: IBaseModelSqlV2;
}): Promise<void> {
  await handleNotNullConstraintError({ error, baseModel });

  const violation = parseConstraintViolation(error);
  if (!violation) return;

  // The write may have hit a linked table (nested-link ops).
  const tableName = baseModel.model.table_name;
  if (
    violation.table &&
    violation.table.toLowerCase() !== tableName?.toLowerCase()
  )
    return;

  const column = resolveViolatedColumn(
    violation,
    await baseModel.model.getColumns(),
    tableName,
  );
  if (!column?.title) return;

  const extracted = DBErrorExtractor.get().extractDbError(error, {
    ignoreDefault: true,
  });
  if (!extracted) return;

  throw new ExtractedDbError({
    ...extracted,
    message: constraintViolationMessage(violation, column.title),
    details: {
      ...extracted.details,
      column: column.title,
      ...(violation.constraint && { constraint: violation.constraint }),
    },
  });
}
