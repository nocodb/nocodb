/**
 * Pure helper for schema-sync column-type change detection.
 *
 * Kept separate from the NestJS service so it can be unit-tested without a
 * full application context.  Import from `nocodb-sdk` or directly from this
 * file.
 */

/**
 * Returns true when a column's database type (or its length/precision for
 * parameterised types) has changed in a way that NocoDB must sync.
 *
 * Rules:
 *  - All dialects: raw `dt` string inequality triggers a change.
 *  - MySQL/mysql2:  enum/set option-list (`dtxp`) changes trigger a change.
 *  - PG: `character varying` / `char` / `character` length (`dtxp`) changes
 *    trigger a change even when the base type string stays the same.
 *    String coercion handles the number (PostgreSQL) vs string (NocoDB
 *    metadata DB) mismatch.
 *  - PG native enum: option-list or underlying enum type name changes.
 */
export function isColumnTypeChanged(
  sourceType: string,
  oldCol: {
    dt?: string;
    dtxp?: any;
    udt_typtype?: string;
    internal_meta?: any;
  },
  column: {
    dt?: string;
    dtxp?: any;
    udt_typtype?: string;
    data_type_custom?: string;
  },
): boolean {
  return (
    // Base type changed (all dialects)
    oldCol.dt !== column.dt ||
    // MySQL / mysql2: enum or set option list changed
    (['mysql', 'mysql2'].includes(sourceType) &&
      ['set', 'enum'].includes(column.dt) &&
      column.dtxp !== oldCol.dtxp) ||
    // PG: length-parameterised types — detect varchar(n) / char(n) length
    // changes even when the base dt string stays 'character varying'.
    // String coercion avoids number/string inequality when PostgreSQL
    // returns an integer and NocoDB's metadata DB stores a string.
    (sourceType === 'pg' &&
      ['character varying', 'char', 'character'].includes(column.dt) &&
      String(column.dtxp ?? '') !== String(oldCol.dtxp ?? '')) ||
    // PG native enum: option list or underlying enum type name changed
    (sourceType === 'pg' &&
      column.udt_typtype === 'e' &&
      (column.dtxp !== oldCol.dtxp ||
        column.data_type_custom !== oldCol.internal_meta?.pg_enum_type_name))
  );
}
