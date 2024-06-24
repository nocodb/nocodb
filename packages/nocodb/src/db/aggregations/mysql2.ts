import {
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
  _column,
  baseModelSqlv2,
  aggregation,
  column,
  parsedFormulaType,
  aggType,
}: {
  _column: Column;
  baseModelSqlv2: BaseModelSqlv2;
  aggregation: string;
  column: string;
  parsedFormulaType?: FormulaDataTypes;
  aggType:
    | 'common'
    | 'numerical'
    | 'boolean'
    | 'date'
    | 'attachment'
    | 'unknown';
}) {
  let aggregationSql: Knex.Raw | undefined;

  const { dbDriver: knex } = baseModelSqlv2;

  let secondaryCondition: any = "''";
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
    ].includes(_column.uidt) ||
    [FormulaDataTypes.DATE, FormulaDataTypes.NUMERIC].includes(
      parsedFormulaType,
    )
  ) {
    secondaryCondition = 'NULL';
  } else if ([UITypes.Rating].includes(_column.uidt)) {
    secondaryCondition = 0;
  }

  if (aggType === 'common') {
    switch (aggregation) {
      case CommonAggregations.Count:
        aggregationSql = knex.raw(`COUNT(*) AS ??`, [_column.id]);
        break;
      case CommonAggregations.CountEmpty:
        if ([UITypes.JSON].includes(_column.uidt)) {
          aggregationSql = knex.raw(
            `SUM(CASE WHEN JSON_LENGTH(??) IS NULL THEN 1 ELSE 0 END) AS ??`,
            [column, _column.id],
          );
          break;
        }
        aggregationSql = knex.raw(
          `SUM(CASE WHEN (??) IS NULL OR (??) = ${secondaryCondition} THEN 1 ELSE 0 END) AS ??`,
          [column, column, _column.id],
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
          ].includes(_column.uidt) ||
          [FormulaDataTypes.DATE, FormulaDataTypes.NUMERIC].includes(
            parsedFormulaType,
          )
        ) {
          aggregationSql = knex.raw(
            `SUM(CASE WHEN (??) IS NOT NULL THEN 1 ELSE 0 END) AS ??`,
            [column, _column.id],
          );
          break;
        }
        aggregationSql = knex.raw(
          `SUM(CASE WHEN (??) IS NOT NULL AND (??) != ${secondaryCondition} THEN 1 ELSE 0 END) AS ??`,
          [column, column, _column.id],
        );
        break;
      case CommonAggregations.CountUnique:
        if ([UITypes.JSON].includes(_column.uidt)) {
          aggregationSql = knex.raw(
            `COUNT(DISTINCT JSON_UNQUOTE(JSON_EXTRACT(??, '$'))) AS ??`,
            [column, _column.id],
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
          ].includes(_column.uidt) ||
          [FormulaDataTypes.DATE, FormulaDataTypes.NUMERIC].includes(
            parsedFormulaType,
          )
        ) {
          aggregationSql = knex.raw(
            `COUNT(DISTINCT CASE WHEN (??) IS NOT NULL THEN (??) END) AS ??`,
            [column, column, _column.id],
          );
          break;
        }
        aggregationSql = knex.raw(
          `COUNT(DISTINCT CASE WHEN ?? IS NOT NULL AND ?? != ${secondaryCondition} THEN ?? END) AS ??`,
          [column, column, column, _column.id],
        );
        break;
      case CommonAggregations.PercentEmpty:
        if ([UITypes.JSON].includes(_column.uidt)) {
          aggregationSql = knex.raw(
            `(SUM(CASE WHEN JSON_LENGTH(??) IS NULL THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0)) AS ??`,
            [column, _column.id],
          );
          break;
        }
        aggregationSql = knex.raw(
          `(SUM(CASE WHEN (??) IS NULL OR (??) = ${secondaryCondition} THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0)) AS ??`,
          [column, column, _column.id],
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
          ].includes(_column.uidt) ||
          [FormulaDataTypes.DATE, FormulaDataTypes.NUMERIC].includes(
            parsedFormulaType,
          )
        ) {
          aggregationSql = knex.raw(
            `(SUM(CASE WHEN (??) IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0)) AS ??`,
            [column, _column.id],
          );
          break;
        }
        aggregationSql = knex.raw(
          `(SUM(CASE WHEN (??) IS NOT NULL AND (??) != ${secondaryCondition} THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0)) AS ??`,
          [column, column, _column.id],
        );
        break;
      case CommonAggregations.PercentUnique:
        if ([UITypes.JSON].includes(_column.uidt)) {
          aggregationSql = knex.raw(
            `COUNT(DISTINCT JSON_UNQUOTE(JSON_EXTRACT((??), '$'))) * 100.0 / NULLIF(COUNT(*), 0) AS ??`,
            [column, _column.id],
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
          ].includes(_column.uidt) ||
          [FormulaDataTypes.DATE, FormulaDataTypes.NUMERIC].includes(
            parsedFormulaType,
          )
        ) {
          aggregationSql = knex.raw(
            `(COUNT(DISTINCT CASE WHEN ?? IS NOT NULL THEN ?? END) * 100.0 / NULLIF(COUNT(*), 0)) AS ??`,
            [column, column, _column.id],
          );
          break;
        }
        aggregationSql = knex.raw(
          `(COUNT(DISTINCT CASE WHEN ?? IS NOT NULL AND ?? != ${secondaryCondition} THEN ?? END) * 100.0 / NULLIF(COUNT(*), 0)) AS ??`,
          [column, column, column, _column.id],
        );
        break;
      case CommonAggregations.None:
        break;
    }
  } else if (aggType === 'numerical') {
    switch (aggregation) {
      case NumericalAggregations.Avg:
        if (_column.uidt === UITypes.Rating) {
          aggregationSql = knex.raw(
            `AVG(CASE WHEN (??) != ${secondaryCondition} THEN (??) ELSE NULL END) AS ??`,
            [column, column, _column.id],
          );
          break;
        }
        aggregationSql = knex.raw(`AVG((??)) AS ??`, [column, _column.id]);
        break;
      case NumericalAggregations.Max:
        aggregationSql = knex.raw(`MAX((??)) AS ??`, [column, _column.id]);
        break;
      case NumericalAggregations.Min:
        if (_column.uidt === UITypes.Rating) {
          aggregationSql = knex.raw(
            `MIN(CASE WHEN (??) != ${secondaryCondition} THEN (??) ELSE NULL END) AS ??`,
            [column, column, _column.id],
          );
          break;
        }
        aggregationSql = knex.raw(`MIN((??)) AS ??`, [column, _column.id]);
        break;
      case NumericalAggregations.Sum:
        aggregationSql = knex.raw(`SUM((??)) AS ??`, [column, _column.id]);
        break;
      case NumericalAggregations.StandardDeviation:
        if (_column.uidt === UITypes.Rating) {
          aggregationSql = knex.raw(`STDDEV((??)) AS ??`, [column, _column.id]);
          break;
        }
        aggregationSql = knex.raw(`STDDEV((??)) AS ??`, [column, _column.id]);
        break;
      case NumericalAggregations.Range:
        if (_column.uidt === UITypes.Rating) {
          aggregationSql = knex.raw(
            `(MAX((??)) - MIN(CASE WHEN (??) != ${secondaryCondition} THEN (??) ELSE NULL END)) AS ??`,
            [column, column, column, _column.id],
          );
          break;
        }
        aggregationSql = knex.raw(`(MAX((??)) - MIN((??))) AS ??`, [
          column,
          column,
          _column.id,
        ]);
        break;
      case NumericalAggregations.Median:
        // Need to be fixed @DarkPhoenix2704
        aggregationSql = knex.raw(
          `(
        SELECT AVG(??)
        FROM (
          SELECT ??
          FROM (
            SELECT ??, 
            ROW_NUMBER() OVER (ORDER BY ??) AS row_num, 
            COUNT(*) OVER() AS total_rows
            FROM ??
          ) AS sorted_table
          WHERE row_num IN (FLOOR((total_rows + 1) / 2), FLOOR((total_rows + 2) / 2))
        ) AS median_table
      ) AS ??`,
          [column, column, column, column, baseModelSqlv2.tnPath, _column.id],
        );
        break;
      default:
        break;
    }
  } else if (aggType === 'boolean') {
    switch (aggregation) {
      case BooleanAggregations.Checked:
        aggregationSql = knex.raw(
          `SUM(CASE WHEN ?? = true THEN 1 ELSE 0 END) AS ??`,
          [column, _column.id],
        );
        break;
      case BooleanAggregations.Unchecked:
        aggregationSql = knex.raw(
          `SUM(CASE WHEN ?? = false OR ?? IS NULL THEN 1 ELSE 0 END) AS ??`,
          [column, column, _column.id],
        );
        break;
      case BooleanAggregations.PercentChecked:
        aggregationSql = knex.raw(
          `(SUM(CASE WHEN ?? = true THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0)) AS ??`,
          [column, _column.id],
        );
        break;
      case BooleanAggregations.PercentUnchecked:
        aggregationSql = knex.raw(
          `(SUM(CASE WHEN ?? = false OR ?? IS NULL THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0)) AS ??`,
          [column, column, _column.id],
        );
        break;
      default:
        break;
    }
  } else if (aggType === 'date') {
    switch (aggregation) {
      case DateAggregations.EarliestDate:
        aggregationSql = knex.raw(`MIN(??) AS ??`, [column, _column.id]);
        break;
      case DateAggregations.LatestDate:
        aggregationSql = knex.raw(`MAX(??) AS ??`, [column, _column.id]);
        break;
      case DateAggregations.DateRange:
        aggregationSql = knex.raw(
          `TIMESTAMPDIFF(DAY, MIN(??), MAX(??)) AS ??`,
          [column, column, _column.id],
        );
        break;
      case DateAggregations.MonthRange:
        aggregationSql = knex.raw(
          `PERIOD_DIFF(DATE_FORMAT(MAX(??), '%Y%m'), DATE_FORMAT(MIN(??), '%Y%m')) AS ??`,
          [column, column, _column.id],
        );
        break;
      default:
        break;
    }
  } else if (aggType === 'attachment') {
    switch (aggregation) {
      case AttachmentAggregations.AttachmentSize:
        aggregationSql = knex.raw(
          `(SELECT SUM(JSON_EXTRACT(json_object, '$.size')) FROM ?? CROSS JOIN JSON_TABLE(CAST(?? AS JSON), '$[*]' COLUMNS (json_object JSON PATH '$')) AS json_array) AS ??`,
          [baseModelSqlv2.tnPath, column, _column.id],
        );
        break;
    }
  }

  return aggregationSql?.toQuery();
}
