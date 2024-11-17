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
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { Knex } from 'knex';

export function genMysql2AggregatedQuery({
  column,
  baseModelSqlv2,
  aggregation,
  column_query,
  parsedFormulaType,
  aggType,
  alias,
}: {
  column: Column;
  baseModelSqlv2: BaseModelSqlv2;
  aggregation: string;
  column_query: string;
  parsedFormulaType?: FormulaDataTypes;
  aggType:
    | 'common'
    | 'numerical'
    | 'boolean'
    | 'date'
    | 'attachment'
    | 'unknown';
  alias?: string;
}) {
  let aggregationSql: Knex.Raw | undefined;

  const { dbDriver: knex } = baseModelSqlv2;

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
            `(COUNT(DISTINCT CASE WHEN ?? IS NOT NULL THEN ?? END) * 100.0 / NULLIF(COUNT(*), 0))`,
            [column_query, column_query],
          );
          break;
        }
        aggregationSql = knex.raw(
          `(COUNT(DISTINCT CASE WHEN ?? IS NOT NULL AND ?? != ${condnValue} THEN ?? END) * 100.0 / NULLIF(COUNT(*), 0))`,
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
          aggregationSql = knex.raw(`STDDEV((??))`, [column_query]);
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
        // This is the sqlite3 port median query. Need to use native mysql median query
        aggregationSql = knex.raw(
          `
  (
    SELECT AVG(??)
    FROM (
      SELECT ??
      FROM ??
      ORDER BY ??
      LIMIT 2 - (SELECT COUNT(*) FROM ??) % 2    -- Handle even/odd number of rows
      OFFSET (SELECT (COUNT(*) - 1) / 2 FROM ??) -- Calculate the median offset
    ) AS median_subquery
  )`,
          [
            column_query,
            column_query,
            baseModelSqlv2.tnPath,
            column_query,
            baseModelSqlv2.tnPath,
            baseModelSqlv2.tnPath,
          ],
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
          [baseModelSqlv2.tnPath, column_query],
        );
        break;
    }
  }

  if (alias && aggregationSql) {
    if (
      ![AllAggregations.EarliestDate, AllAggregations.LatestDate].includes(
        aggregation as any,
      )
    ) {
      aggregationSql = knex.raw(`COALESCE(??, 0)`, [aggregationSql]);
    }

    aggregationSql = knex.raw(`?? AS ??`, [aggregationSql, alias]);
  }

  return aggregationSql?.toQuery();
}
