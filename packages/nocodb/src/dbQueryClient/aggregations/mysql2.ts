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

export function genMysql2AggregatedQuery({
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
  // Filtered FROM-table query. median / attachment-size build their own
  // subquery, so they must run over the filtered row set — not the raw table —
  // or filters / RLS / search / soft-delete are ignored.
  baseQuery?: Knex.QueryBuilder;
}) {
  let aggregationSql: Knex.Raw | undefined;

  const { dbDriver: knex } = baseModelSqlv2;

  // Filtered derived table exposing the column value as a plain `nc_val` column.
  // Used as the FROM source for the self-contained-subquery aggregates below so
  // they honor filters; falls back to the raw table only when no baseQuery was
  // supplied. (Inline aggregates keep using `column_query` over the outer query.)
  const derivedInner = baseQuery
    ? baseQuery
        .clone()
        .clearSelect()
        .select(knex.raw(`(??) as nc_val`, [column_query]))
    : undefined;
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
            `SUM(CASE WHEN JSON_LENGTH(??) IS NULL THEN 1 ELSE 0 END)`,
            [column_query],
          );
          break;
        }
        aggregationSql = knex.raw(
          `SUM(CASE WHEN (??) IS NULL OR (??) = ${condnValue} THEN 1 ELSE 0 END)`,
          [column_query, column_query],
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
            [column_query],
          );
          break;
        }
        aggregationSql = knex.raw(
          `SUM(CASE WHEN (??) IS NOT NULL AND (??) != ${condnValue} THEN 1 ELSE 0 END)`,
          [column_query, column_query],
        );
        break;
      case CommonAggregations.CountUnique:
        if ([UITypes.JSON].includes(column.uidt)) {
          aggregationSql = knex.raw(
            `COUNT(DISTINCT JSON_UNQUOTE(JSON_EXTRACT(??, '$')))`,
            [column_query],
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
            [column_query, column_query],
          );
          break;
        }
        aggregationSql = knex.raw(
          `COUNT(DISTINCT CASE WHEN ?? IS NOT NULL AND ?? != ${condnValue} THEN ?? END)`,
          [column_query, column_query, column_query],
        );
        break;
      case CommonAggregations.PercentEmpty:
        if ([UITypes.JSON].includes(column.uidt)) {
          aggregationSql = knex.raw(
            `(SUM(CASE WHEN JSON_LENGTH(??) IS NULL THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0))`,
            [column_query],
          );
          break;
        }
        aggregationSql = knex.raw(
          `(SUM(CASE WHEN (??) IS NULL OR (??) = ${condnValue} THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0))`,
          [column_query, column_query],
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
            [column_query],
          );
          break;
        }
        aggregationSql = knex.raw(
          `(SUM(CASE WHEN (??) IS NOT NULL AND (??) != ${condnValue} THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0))`,
          [column_query, column_query],
        );
        break;
      case CommonAggregations.PercentUnique:
        if ([UITypes.JSON].includes(column.uidt)) {
          aggregationSql = knex.raw(
            `COUNT(DISTINCT JSON_UNQUOTE(JSON_EXTRACT((??), '$'))) * 100.0 / NULLIF(COUNT(*), 0)`,
            [column_query],
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
            [column_query, column_query],
          );
          break;
        }
        aggregationSql = knex.raw(
          `(COUNT(DISTINCT CASE WHEN (??) IS NOT NULL AND (??) != ${condnValue} THEN (??) END) * 100.0 / NULLIF(COUNT(*), 0))`,
          [column_query, column_query, column_query],
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
            `AVG(CASE WHEN (??) != ${condnValue} THEN (??) ELSE NULL END)`,
            [column_query, column_query],
          );
          break;
        }
        aggregationSql = knex.raw(`AVG((??))`, [column_query]);
        break;
      case NumericalAggregations.Max:
        aggregationSql = knex.raw(`MAX((??))`, [column_query]);
        break;
      case NumericalAggregations.Min:
        if (column.uidt === UITypes.Rating) {
          aggregationSql = knex.raw(
            `MIN(CASE WHEN (??) != ${condnValue} THEN (??) ELSE NULL END)`,
            [column_query, column_query],
          );
          break;
        }
        aggregationSql = knex.raw(`MIN((??))`, [column_query]);
        break;
      case NumericalAggregations.Sum:
        aggregationSql = knex.raw(`SUM((??)) `, [column_query]);
        break;
      case NumericalAggregations.StandardDeviation:
        if (column.uidt === UITypes.Rating) {
          aggregationSql = knex.raw(
            `STDDEV(CASE WHEN (??) != ${condnValue} THEN (??) ELSE NULL END)`,
            [column_query, column_query],
          );
          break;
        }
        aggregationSql = knex.raw(`STDDEV((??))`, [column_query]);
        break;
      case NumericalAggregations.Range:
        if (column.uidt === UITypes.Rating) {
          aggregationSql = knex.raw(
            `(MAX((??)) - MIN(CASE WHEN (??) != ${condnValue} THEN (??) ELSE NULL END))`,
            [column_query, column_query, column_query],
          );
          break;
        }
        aggregationSql = knex.raw(`(MAX((??)) - MIN((??)))`, [
          column_query,
          column_query,
        ]);
        break;
      case NumericalAggregations.Median:
        // Window-function median (MySQL 8.0+).
        aggregationSql = knex.raw(
          `
  (
    SELECT AVG(nc_med_val)
    FROM (
      SELECT
        (??) AS nc_med_val,
        ROW_NUMBER() OVER (ORDER BY (??)) AS nc_med_rn,
        COUNT(*) OVER () AS nc_med_cnt
      FROM ??
      WHERE (??) IS NOT NULL
    ) AS nc_med_q
    WHERE nc_med_rn IN (
      FLOOR((nc_med_cnt + 1) / 2),
      FLOOR((nc_med_cnt + 2) / 2)
    )
  )`,
          [subAggCol, subAggCol, subAggFrom, subAggCol],
        );
        break;
      default:
        break;
    }
  } else if (aggType === 'boolean') {
    switch (aggregation) {
      case BooleanAggregations.Checked:
        aggregationSql = knex.raw(
          `SUM(CASE WHEN ?? = true THEN 1 ELSE 0 END)`,
          [column_query],
        );
        break;
      case BooleanAggregations.Unchecked:
        aggregationSql = knex.raw(
          `SUM(CASE WHEN ?? = false OR ?? IS NULL THEN 1 ELSE 0 END)`,
          [column_query, column_query],
        );
        break;
      case BooleanAggregations.PercentChecked:
        aggregationSql = knex.raw(
          `(SUM(CASE WHEN ?? = true THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0))`,
          [column_query],
        );
        break;
      case BooleanAggregations.PercentUnchecked:
        aggregationSql = knex.raw(
          `(SUM(CASE WHEN ?? = false OR ?? IS NULL THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0))`,
          [column_query, column_query],
        );
        break;
      default:
        break;
    }
  } else if (aggType === 'date') {
    switch (aggregation) {
      case DateAggregations.EarliestDate:
        aggregationSql = knex.raw(`MIN(??)`, [column_query]);
        break;
      case DateAggregations.LatestDate:
        aggregationSql = knex.raw(`MAX(??)`, [column_query]);
        break;
      case DateAggregations.DateRange:
        aggregationSql = knex.raw(`TIMESTAMPDIFF(DAY, MIN(??), MAX(??))`, [
          column_query,
          column_query,
        ]);
        break;
      case DateAggregations.MonthRange:
        aggregationSql = knex.raw(
          `PERIOD_DIFF(DATE_FORMAT(MAX(??), '%Y%m'), DATE_FORMAT(MIN(??), '%Y%m'))`,
          [column_query, column_query],
        );
        break;
      default:
        break;
    }
  } else if (aggType === 'attachment') {
    switch (aggregation) {
      case AttachmentAggregations.AttachmentSize:
        aggregationSql = knex.raw(
          `(SELECT SUM(JSON_EXTRACT(json_object, '$.size')) FROM ?? CROSS JOIN JSON_TABLE(CAST(?? AS JSON), '$[*]' COLUMNS (json_object JSON PATH '$')) AS json_array)`,
          [subAggFrom, subAggCol],
        );
        break;
    }
  }

  if (aggregationSql) {
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
