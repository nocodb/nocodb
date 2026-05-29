import {
  AllAggregations,
  AttachmentAggregations,
  BooleanAggregations,
  CommonAggregations,
  DateAggregations,
  FormulaDataTypes,
  NumericalAggregations,
  UITypes,
} from 'nocodb-sdk';
import type { Column } from '~/models';
import type { Knex } from 'knex';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';

// Virtual column types whose `column_query` is a correlated subquery. T-SQL
// forbids aggregating over a subquery ("Cannot perform an aggregate function on
// an expression containing an aggregate or a subquery", error 130), so for these
// we materialize the per-row value into a derived table column first, then
// aggregate over that plain column. See `materialize` handling below.
const MATERIALIZE_UITYPES = [
  UITypes.Rollup,
  UITypes.Lookup,
  UITypes.Formula,
  UITypes.Links,
  UITypes.LinkToAnotherRecord,
];

// SQL Server (T-SQL) aggregation query builder. Mirrors the MySQL/SQLite
// CASE-based approach since T-SQL has no `FILTER (WHERE ...)`.
//
// T-SQL specifics handled here:
//  - Virtual columns (Rollup/Lookup/Formula/Links/LTAR) are materialized into a
//    filtered derived table (see MATERIALIZE_UITYPES) so the aggregate runs over
//    a plain column instead of a subquery. Requires `baseQuery` (the filtered
//    FROM-table query) to be passed; filters / RLS are preserved.
//  - String comparisons / DISTINCT are wrapped in CAST(.. AS NVARCHAR(MAX)):
//    NocoDB maps LongText → `ntext`, and the legacy text/ntext/image types
//    cannot be used with `=`, `!=`, DISTINCT, GROUP BY or ORDER BY.
//  - Boolean columns are `bit` (0/1) — compared with `= 1` / `= 0`.
//  - Population stddev is STDEVP (matches pg `stddev_pop` / mysql `STDDEV`).
//  - Date diffs use DATEDIFF(DAY|MONTH, min, max).
//  - Median uses PERCENTILE_CONT (window-only in T-SQL → scalar subquery).
//  - Attachment size parses the JSON array with OPENJSON (ISJSON-guarded).
export function genMssqlAggregateQuery({
  column,
  baseModelSqlv2,
  aggregation,
  column_query,
  parsedFormulaType,
  aggType,
  alias,
  baseQuery,
}: {
  column: Column;
  baseModelSqlv2: IBaseModelSqlV2;
  aggregation: string;
  column_query: string | Knex.QueryBuilder;
  parsedFormulaType?: FormulaDataTypes;
  aggType:
    | 'common'
    | 'numerical'
    | 'boolean'
    | 'date'
    | 'attachment'
    | 'unknown';
  alias?: string;
  // Filtered FROM-table query (no select) used to materialize virtual columns.
  baseQuery?: Knex.QueryBuilder;
}) {
  let aggregationSql: Knex.Raw | undefined;

  const { dbDriver: knex } = baseModelSqlv2;

  const isVirtual = MATERIALIZE_UITYPES.includes(column.uidt);

  // Virtual columns (Rollup/Lookup/Formula/Links/LTAR) expose a correlated
  // subquery as their column expression; T-SQL can't aggregate over a subquery
  // (error 130), so they're materialized into a derived table and aggregated
  // over the plain `nc_val` column. Requires baseQuery (the filtered FROM query).
  const materialize = !!baseQuery && isVirtual;

  // median / attachment-size build their OWN subquery (PERCENTILE_CONT is
  // window-only; attachment-size parses JSON per row), so they must run over the
  // FILTERED row set — not the raw table — or filters / RLS / search / soft-delete
  // are ignored and the result is computed over the whole table (wrong).
  const needsFilteredSubquery =
    aggregation === NumericalAggregations.Median ||
    aggregation === AttachmentAggregations.AttachmentSize;

  // Filtered derived table exposing the column value as a plain `nc_val` column.
  // Built whenever a baseQuery is available and either path above needs it.
  const derivedInner =
    baseQuery && (isVirtual || needsFilteredSubquery)
      ? baseQuery
          .clone()
          .clearSelect()
          .select(knex.raw(`(??) as nc_val`, [column_query]))
      : undefined;

  // Inline aggregates run in the outer (already-filtered) query: virtual columns
  // reference the materialized `nc_val`; plain columns use the raw expression.
  const cq: string | Knex.QueryBuilder = materialize ? 'nc_val' : column_query;

  // Self-contained-subquery aggregates (median/attachment) run over their own
  // FROM: prefer the filtered derived table (referencing `nc_val`); fall back to
  // the raw table only when no baseQuery was supplied (filters then unavailable).
  const subAggFrom: string | Knex.Raw = derivedInner
    ? knex.raw(`(??) as nc_agg_sub`, [derivedInner])
    : baseModelSqlv2.tnPath;
  const subAggCol: string | Knex.QueryBuilder = derivedInner
    ? 'nc_val'
    : column_query;

  let condnValue: any = "''";
  if (
    [
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
      UITypes.Date,
      UITypes.DateTime,
      UITypes.Number,
      UITypes.Decimal,
      UITypes.Year,
      UITypes.Currency,
      UITypes.Duration,
      UITypes.Time,
      UITypes.Percent,
      UITypes.Rollup,
      UITypes.Links,
      UITypes.ID,
    ].includes(column.uidt) ||
    [FormulaDataTypes.DATE, FormulaDataTypes.NUMERIC].includes(
      parsedFormulaType,
    )
  ) {
    condnValue = 'NULL';
  } else if ([UITypes.Rating].includes(column.uidt)) {
    condnValue = 0;
  }

  if (aggType === 'common') {
    switch (aggregation) {
      case CommonAggregations.Count:
        aggregationSql = knex.raw(`COUNT(*)`);
        break;
      case CommonAggregations.CountEmpty:
        if ([UITypes.JSON].includes(column.uidt)) {
          aggregationSql = knex.raw(
            `SUM(CASE WHEN (??) IS NULL THEN 1 ELSE 0 END)`,
            [cq],
          );
          break;
        }
        aggregationSql = knex.raw(
          `SUM(CASE WHEN (??) IS NULL OR CAST((??) AS NVARCHAR(MAX)) = ${condnValue} THEN 1 ELSE 0 END)`,
          [cq, cq],
        );
        break;
      case CommonAggregations.CountFilled:
        if (
          [
            UITypes.CreatedTime,
            UITypes.LastModifiedTime,
            UITypes.Date,
            UITypes.DateTime,
            UITypes.Number,
            UITypes.Decimal,
            UITypes.Year,
            UITypes.Currency,
            UITypes.Duration,
            UITypes.Percent,
            UITypes.Time,
            UITypes.JSON,
            UITypes.Rollup,
            UITypes.Links,
            UITypes.ID,
            UITypes.LinkToAnotherRecord,
            UITypes.Lookup,
          ].includes(column.uidt) ||
          [FormulaDataTypes.DATE, FormulaDataTypes.NUMERIC].includes(
            parsedFormulaType,
          )
        ) {
          aggregationSql = knex.raw(
            `SUM(CASE WHEN (??) IS NOT NULL THEN 1 ELSE 0 END)`,
            [cq],
          );
          break;
        }
        aggregationSql = knex.raw(
          `SUM(CASE WHEN (??) IS NOT NULL AND CAST((??) AS NVARCHAR(MAX)) != ${condnValue} THEN 1 ELSE 0 END)`,
          [cq, cq],
        );
        break;
      case CommonAggregations.CountUnique:
        if ([UITypes.JSON].includes(column.uidt)) {
          aggregationSql = knex.raw(
            `COUNT(DISTINCT CASE WHEN (??) IS NOT NULL THEN CAST((??) AS NVARCHAR(MAX)) END)`,
            [cq, cq],
          );
          break;
        }
        if (
          [
            UITypes.CreatedTime,
            UITypes.LastModifiedTime,
            UITypes.Date,
            UITypes.DateTime,
            UITypes.Number,
            UITypes.Decimal,
            UITypes.Year,
            UITypes.Currency,
            UITypes.Time,
            UITypes.Duration,
            UITypes.Percent,
            UITypes.Rollup,
            UITypes.Links,
            UITypes.ID,
            UITypes.LinkToAnotherRecord,
            UITypes.Lookup,
          ].includes(column.uidt) ||
          [FormulaDataTypes.DATE, FormulaDataTypes.NUMERIC].includes(
            parsedFormulaType,
          )
        ) {
          aggregationSql = knex.raw(
            `COUNT(DISTINCT CASE WHEN (??) IS NOT NULL THEN (??) END)`,
            [cq, cq],
          );
          break;
        }
        aggregationSql = knex.raw(
          `COUNT(DISTINCT CASE WHEN (??) IS NOT NULL AND CAST((??) AS NVARCHAR(MAX)) != ${condnValue} THEN CAST((??) AS NVARCHAR(MAX)) END)`,
          [cq, cq, cq],
        );
        break;
      case CommonAggregations.PercentEmpty:
        if ([UITypes.JSON].includes(column.uidt)) {
          aggregationSql = knex.raw(
            `(SUM(CASE WHEN (??) IS NULL THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0))`,
            [cq],
          );
          break;
        }
        aggregationSql = knex.raw(
          `(SUM(CASE WHEN (??) IS NULL OR CAST((??) AS NVARCHAR(MAX)) = ${condnValue} THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0))`,
          [cq, cq],
        );
        break;
      case CommonAggregations.PercentFilled:
        if (
          [
            UITypes.CreatedTime,
            UITypes.LastModifiedTime,
            UITypes.Date,
            UITypes.DateTime,
            UITypes.Number,
            UITypes.Time,
            UITypes.Decimal,
            UITypes.Year,
            UITypes.Currency,
            UITypes.Duration,
            UITypes.Percent,
            UITypes.JSON,
            UITypes.Rollup,
            UITypes.Links,
            UITypes.ID,
            UITypes.LinkToAnotherRecord,
            UITypes.Lookup,
          ].includes(column.uidt) ||
          [FormulaDataTypes.DATE, FormulaDataTypes.NUMERIC].includes(
            parsedFormulaType,
          )
        ) {
          aggregationSql = knex.raw(
            `(SUM(CASE WHEN (??) IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0))`,
            [cq],
          );
          break;
        }
        aggregationSql = knex.raw(
          `(SUM(CASE WHEN (??) IS NOT NULL AND CAST((??) AS NVARCHAR(MAX)) != ${condnValue} THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0))`,
          [cq, cq],
        );
        break;
      case CommonAggregations.PercentUnique:
        if ([UITypes.JSON].includes(column.uidt)) {
          aggregationSql = knex.raw(
            `(COUNT(DISTINCT CASE WHEN (??) IS NOT NULL THEN CAST((??) AS NVARCHAR(MAX)) END) * 100.0 / NULLIF(COUNT(*), 0))`,
            [cq, cq],
          );
          break;
        }
        if (
          [
            UITypes.CreatedTime,
            UITypes.LastModifiedTime,
            UITypes.Date,
            UITypes.DateTime,
            UITypes.Number,
            UITypes.Decimal,
            UITypes.Year,
            UITypes.Time,
            UITypes.Currency,
            UITypes.Duration,
            UITypes.Percent,
            UITypes.Rollup,
            UITypes.Links,
            UITypes.ID,
            UITypes.LinkToAnotherRecord,
            UITypes.Lookup,
          ].includes(column.uidt) ||
          [FormulaDataTypes.DATE, FormulaDataTypes.NUMERIC].includes(
            parsedFormulaType,
          )
        ) {
          aggregationSql = knex.raw(
            `(COUNT(DISTINCT CASE WHEN (??) IS NOT NULL THEN (??) END) * 100.0 / NULLIF(COUNT(*), 0))`,
            [cq, cq],
          );
          break;
        }
        aggregationSql = knex.raw(
          `(COUNT(DISTINCT CASE WHEN (??) IS NOT NULL AND CAST((??) AS NVARCHAR(MAX)) != ${condnValue} THEN CAST((??) AS NVARCHAR(MAX)) END) * 100.0 / NULLIF(COUNT(*), 0))`,
          [cq, cq, cq],
        );
        break;
      case CommonAggregations.None:
        break;
    }
  } else if (aggType === 'numerical') {
    switch (aggregation) {
      case NumericalAggregations.Avg:
        if (column.uidt === UITypes.Rating) {
          aggregationSql = knex.raw(
            `CAST(AVG(CASE WHEN (??) != ${condnValue} THEN (??) ELSE NULL END) AS FLOAT)`,
            [cq, cq],
          );
          break;
        }
        aggregationSql = knex.raw(`CAST(AVG((??)) AS FLOAT)`, [cq]);
        break;
      case NumericalAggregations.Max:
        aggregationSql = knex.raw(`CAST(MAX((??)) AS FLOAT)`, [cq]);
        break;
      case NumericalAggregations.Min:
        if (column.uidt === UITypes.Rating) {
          aggregationSql = knex.raw(
            `CAST(MIN(CASE WHEN (??) != ${condnValue} THEN (??) ELSE NULL END) AS FLOAT)`,
            [cq, cq],
          );
          break;
        }
        aggregationSql = knex.raw(`CAST(MIN((??)) AS FLOAT)`, [cq]);
        break;
      case NumericalAggregations.Sum:
        aggregationSql = knex.raw(`CAST(SUM((??)) AS FLOAT)`, [cq]);
        break;
      case NumericalAggregations.StandardDeviation:
        // STDEVP = population standard deviation (matches pg stddev_pop / mysql STDDEV).
        if (column.uidt === UITypes.Rating) {
          aggregationSql = knex.raw(
            `CAST(STDEVP(CASE WHEN (??) != ${condnValue} THEN (??) ELSE NULL END) AS FLOAT)`,
            [cq, cq],
          );
          break;
        }
        aggregationSql = knex.raw(`CAST(STDEVP((??)) AS FLOAT)`, [cq]);
        break;
      case NumericalAggregations.Range:
        if (column.uidt === UITypes.Rating) {
          aggregationSql = knex.raw(
            `CAST((MAX((??)) - MIN(CASE WHEN (??) != ${condnValue} THEN (??) ELSE NULL END)) AS FLOAT)`,
            [cq, cq, cq],
          );
          break;
        }
        aggregationSql = knex.raw(`CAST((MAX((??)) - MIN((??))) AS FLOAT)`, [
          cq,
          cq,
        ]);
        break;
      case NumericalAggregations.Median:
        // PERCENTILE_CONT is window-only in T-SQL (same value on every row), so
        // pull a single value via TOP 1 over the (materialized, filtered) source.
        aggregationSql = knex.raw(
          `CAST((SELECT TOP 1 PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (??)) OVER () FROM ??) AS FLOAT)`,
          [subAggCol, subAggFrom],
        );
        break;
      default:
        break;
    }
  } else if (aggType === 'boolean') {
    switch (aggregation) {
      case BooleanAggregations.Checked:
        aggregationSql = knex.raw(`SUM(CASE WHEN (??) = 1 THEN 1 ELSE 0 END)`, [
          cq,
        ]);
        break;
      case BooleanAggregations.Unchecked:
        aggregationSql = knex.raw(
          `SUM(CASE WHEN (??) = 0 OR (??) IS NULL THEN 1 ELSE 0 END)`,
          [cq, cq],
        );
        break;
      case BooleanAggregations.PercentChecked:
        aggregationSql = knex.raw(
          `(SUM(CASE WHEN (??) = 1 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0))`,
          [cq],
        );
        break;
      case BooleanAggregations.PercentUnchecked:
        aggregationSql = knex.raw(
          `(SUM(CASE WHEN (??) = 0 OR (??) IS NULL THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0))`,
          [cq, cq],
        );
        break;
      default:
        break;
    }
  } else if (aggType === 'date') {
    switch (aggregation) {
      case DateAggregations.EarliestDate:
        aggregationSql = knex.raw(`MIN((??))`, [cq]);
        break;
      case DateAggregations.LatestDate:
        aggregationSql = knex.raw(`MAX((??))`, [cq]);
        break;
      case DateAggregations.DateRange:
        aggregationSql = knex.raw(`DATEDIFF(DAY, MIN((??)), MAX((??)))`, [
          cq,
          cq,
        ]);
        break;
      case DateAggregations.MonthRange:
        // DATEDIFF(MONTH, ...) counts calendar-month boundaries crossed, which
        // equals the (year*12 + month) diff used by the other dialects.
        aggregationSql = knex.raw(`DATEDIFF(MONTH, MIN((??)), MAX((??)))`, [
          cq,
          cq,
        ]);
        break;
      default:
        break;
    }
  } else if (aggType === 'attachment') {
    switch (aggregation) {
      case AttachmentAggregations.AttachmentSize:
        // Sum `size` across every attachment object in every row's JSON array.
        // ISJSON guard turns NULL / non-JSON cells into an empty array so they
        // contribute nothing rather than erroring inside OPENJSON.
        aggregationSql = knex.raw(
          `(SELECT SUM(CAST(JSON_VALUE(nc_att.value, '$.size') AS BIGINT)) FROM ?? CROSS APPLY OPENJSON(CASE WHEN ISJSON(CAST((??) AS NVARCHAR(MAX))) = 1 THEN CAST((??) AS NVARCHAR(MAX)) ELSE '[]' END) AS nc_att)`,
          [subAggFrom, subAggCol, subAggCol],
        );
        break;
      default:
        break;
    }
  }

  if (aggregationSql) {
    // Materialized virtual columns: the core aggregate references `nc_val`, which
    // only exists inside the derived table — wrap it in a scalar subquery.
    // Median/attachment already embed their own FROM (subAggFrom), so skip those.
    if (
      materialize &&
      aggregation !== NumericalAggregations.Median &&
      aggregation !== AttachmentAggregations.AttachmentSize
    ) {
      aggregationSql = knex.raw(`(SELECT ?? FROM (??) AS nc_agg_sub)`, [
        aggregationSql,
        derivedInner,
      ]);
    }

    if (
      ![AllAggregations.EarliestDate, AllAggregations.LatestDate].includes(
        aggregation as any,
      )
    ) {
      aggregationSql = knex.raw(`COALESCE(??, 0)`, [aggregationSql]);
    }
    if (alias) {
      aggregationSql = knex.raw(`?? AS ??`, [aggregationSql, alias]);
    }
  }

  return aggregationSql?.toQuery();
}
