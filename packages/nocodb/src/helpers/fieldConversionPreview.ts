import { UITypes } from 'nocodb-sdk';
import pgQueries from '~/db/sql-client/lib/pg/pg.queries';
import {
  extractNumberQuery,
  formatColumn,
  generateCastQuery,
} from '~/db/sql-client/lib/pg/typeCast';

export interface ConversionTarget {
  uidt: UITypes;
  dt: string;
  dtxp?: unknown;
  meta?: Record<string, any>;
}

/** Per-row SQL predicates over the source column, plus helper functions they call. */
export interface ConversionPredicates {
  setupSql: string[];
  nonEmpty: string;
  cleared: string;
  rounded: string;
}

const ROUNDING_TARGETS = new Set<UITypes>([
  UITypes.Number,
  UITypes.Rating,
  UITypes.Percent,
  UITypes.Year,
]);

const TEXT_TARGETS = new Set<UITypes>([
  UITypes.SingleLineText,
  UITypes.LongText,
  UITypes.SingleSelect,
  UITypes.MultiSelect,
  UITypes.Email,
  UITypes.PhoneNumber,
  UITypes.URL,
]);

export const pgNonEmpty = (quotedColumn: string, uidt: string) =>
  `(${quotedColumn} IS NOT NULL AND ${formatColumn(
    quotedColumn,
    uidt as UITypes,
  )} <> '')`;

const stripTerminator = (sql: string) => sql.trim().replace(/;$/, '');

/**
 * What a PG type conversion does to each cell, built from the same cast the
 * `ALTER ... USING` runs (PgClient.alterTableColumn), so the preview cannot
 * drift from the write. `quotedColumn` is the already-quoted source column.
 */
export function pgConversionPredicates(
  quotedColumn: string,
  from: { uidt: string; dt: string },
  to: ConversionTarget,
): ConversionPredicates {
  const source = formatColumn(quotedColumn, from.uidt as UITypes);
  const nonEmpty = pgNonEmpty(quotedColumn, from.uidt);

  // Same dt: no ALTER runs and the stored values stay as they are.
  if (to.dt === from.dt) {
    return {
      setupSql: [],
      nonEmpty,
      cleared: 'FALSE',
      // MultiSelect → SingleSelect keeps only the first choice of each cell.
      rounded:
        from.uidt === UITypes.MultiSelect && to.uidt === UITypes.SingleSelect
          ? `(${quotedColumn} LIKE '%,%')`
          : 'FALSE',
    };
  }

  const setupSql: string[] = [];
  if (
    [UITypes.Date, UITypes.DateTime, UITypes.Time, UITypes.Duration].includes(
      to.uidt,
    )
  ) {
    setupSql.push(pgQueries.dateConversionFunction.default.sql);
  }
  if ([UITypes.Decimal, UITypes.Currency].includes(to.uidt)) {
    setupSql.push(pgQueries.localeNumberFunction.default.sql);
  }

  const castArgs = {
    dt: to.dt,
    source,
    limit: typeof to.dtxp === 'number' ? to.dtxp : null,
    format: to.meta?.date_format || 'YYYY-MM-DD',
    durationType: to.meta?.duration ?? 0,
    meta: to.meta,
    sourceUidt: from.uidt as UITypes,
  };
  const cast = stripTerminator(
    generateCastQuery({ ...castArgs, uidt: to.uidt }),
  );
  // The value the column ends up holding, after the cast into its new dt.
  const stored = /^[a-z ]+$/i.test(to.dt)
    ? `CAST((${cast}) AS ${to.dt})`
    : `(${cast})`;

  let rounded = 'FALSE';
  if (ROUNDING_TARGETS.has(to.uidt)) {
    rounded = `(${stored} <> (${extractNumberQuery(source)}))`;
  } else if (TEXT_TARGETS.has(to.uidt)) {
    rounded = `(${stored}::text <> ${source})`;
  } else if (to.uidt === UITypes.Date) {
    // A Date keeps the day and drops the time of day.
    const dateTime = stripTerminator(
      generateCastQuery({ ...castArgs, uidt: UITypes.DateTime }),
    );
    rounded = `(CAST((${dateTime}) AS time) <> '00:00:00')`;
  }

  return {
    setupSql,
    nonEmpty,
    cleared: `(${nonEmpty} AND ${stored} IS NULL)`,
    rounded: `(${nonEmpty} AND ${stored} IS NOT NULL AND ${rounded})`,
  };
}
