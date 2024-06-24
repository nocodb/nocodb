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

export function genSqlite3AggregateQuery({
  column,
  baseModelSqlv2,
  aggregation,
  column_query,
  parsedFormulaType,
  aggType,
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
    ].includes(column.uidt) ||
    [FormulaDataTypes.DATE, FormulaDataTypes.NUMERIC].includes(
      parsedFormulaType,
    )
  ) {
    secondaryCondition = 'NULL';
  } else if ([UITypes.Rating].includes(column.uidt)) {
    secondaryCondition = 0;
  }

  if (aggType === 'common') {
    switch (aggregation) {
      case CommonAggregations.Count:
        aggregationSql = knex.raw(`COUNT(*) AS ??`, [column.id]);
        break;
      case CommonAggregations.CountEmpty:
        if ([UITypes.JSON].includes(column.uidt)) {
          aggregationSql = knex.raw(
            `SUM(CASE WHEN json_array_length(??) IS NULL THEN 1 ELSE 0 END) AS ??`,
            [column_query, column.id],
          );
          break;
        }
        aggregationSql = knex.raw(
          `SUM(CASE WHEN (??) IS NULL OR (??) = ${secondaryCondition} THEN 1 ELSE 0 END) AS ??`,
          [column_query, column_query, column.id],
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
            `SUM(CASE WHEN (??) IS NOT NULL THEN 1 ELSE 0 END) AS ??`,
            [column_query, column.id],
          );
          break;
        }
        aggregationSql = knex.raw(
          `SUM(CASE WHEN (??) IS NOT NULL AND (??) != ${secondaryCondition} THEN 1 ELSE 0 END) AS ??`,
          [column_query, column_query, column.id],
        );
        break;
      case CommonAggregations.CountUnique:
        if ([UITypes.JSON].includes(column.uidt)) {
          aggregationSql = knex.raw(
            `COUNT(DISTINCT json_extract(??, '$')) AS ??`,
            [column_query, column.id],
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
            `COUNT(DISTINCT CASE WHEN (??) IS NOT NULL THEN (??) END) AS ??`,
            [column_query, column_query, column.id],
          );
          break;
        }
        aggregationSql = knex.raw(
          `COUNT(DISTINCT CASE WHEN (??) IS NOT NULL AND (??) != ${secondaryCondition} THEN ?? END) AS ??`,
          [column_query, column_query, column_query, column.id],
        );
        break;
      case CommonAggregations.PercentEmpty:
        if ([UITypes.JSON].includes(column.uidt)) {
          aggregationSql = knex.raw(
            `(SUM(CASE WHEN json_array_length(??) IS NULL THEN 1 ELSE 0 END) * 100.0 / IFNULL(COUNT(*), 0)) AS ??`,
            [column_query, column.id],
          );
          break;
        }
        aggregationSql = knex.raw(
          `(SUM(CASE WHEN (??) IS NULL OR (??) = ${secondaryCondition} THEN 1 ELSE 0 END) * 100.0 / IFNULL(COUNT(*), 0)) AS ??`,
          [column_query, column_query, column.id],
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
            `(SUM(CASE WHEN (??) IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / IFNULL(COUNT(*), 0)) AS ??`,
            [column_query, column.id],
          );
          break;
        }
        aggregationSql = knex.raw(
          `(SUM(CASE WHEN (??) IS NOT NULL AND (??) != ${secondaryCondition} THEN 1 ELSE 0 END) * 100.0 / IFNULL(COUNT(*), 0)) AS ??`,
          [column_query, column_query, column.id],
        );
        break;
      case CommonAggregations.PercentUnique:
        if ([UITypes.JSON].includes(column.uidt)) {
          aggregationSql = knex.raw(
            `COUNT(DISTINCT json_extract((??), '$')) * 100.0 / IFNULL(COUNT(*), 0) AS ??`,
            [column_query, column.id],
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
            `(COUNT(DISTINCT CASE WHEN (??) IS NOT NULL THEN (??) END) * 100.0 / IFNULL(COUNT(*), 0)) AS ??`,
            [column_query, column_query, column.id],
          );
          break;
        }
        aggregationSql = knex.raw(
          `(COUNT(DISTINCT CASE WHEN (??) IS NOT NULL AND (??) != ${secondaryCondition} THEN (??) END) * 100.0 / IFNULL(COUNT(*), 0)) AS ??`,
          [column_query, column_query, column_query, column.id],
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
            `AVG(CASE WHEN (??) != ${secondaryCondition} THEN (??) ELSE NULL END) AS ??`,
            [column_query, column_query, column.id],
          );
          break;
        }
        aggregationSql = knex.raw(`AVG((??)) AS ??`, [column_query, column.id]);
        break;
      case NumericalAggregations.Max:
        aggregationSql = knex.raw(`MAX((??)) AS ??`, [column_query, column.id]);
        break;
      case NumericalAggregations.Min:
        if (column.uidt === UITypes.Rating) {
          aggregationSql = knex.raw(
            `MIN(CASE WHEN (??) != ${secondaryCondition} THEN (??) ELSE NULL END) AS ??`,
            [column_query, column_query, column.id],
          );
          break;
        }
        aggregationSql = knex.raw(`MIN((??)) AS ??`, [column_query, column.id]);
        break;
      case NumericalAggregations.Sum:
        aggregationSql = knex.raw(`SUM((??)) AS ??`, [column_query, column.id]);
        break;
      case NumericalAggregations.StandardDeviation:
        aggregationSql = knex.raw(
          `(
    SELECT 
      CASE 
        WHEN COUNT(*) > 0 THEN 
          SQRT(SUM(((??) - avg_value) * ((??) - avg_value)) / COUNT(*))
        ELSE 
          NULL 
      END AS ??
    FROM (
      SELECT 
        (??), 
        (SELECT AVG((??)) FROM ??) AS avg_value
      FROM 
        ??
    )
  ) AS ??`,
          [
            column_query,
            column_query,
            column.id,
            column_query,
            column_query,
            baseModelSqlv2.tnPath,
            baseModelSqlv2.tnPath,
            column.id,
          ],
        );

        break;
      case NumericalAggregations.Range:
        if (column.uidt === UITypes.Rating) {
          aggregationSql = knex.raw(
            `(MAX((??)) - MIN(CASE WHEN (??) != ${secondaryCondition} THEN (??) ELSE NULL END)) AS ??`,
            [column_query, column_query, column_query, column.id],
          );
          break;
        }
        aggregationSql = knex.raw(`(MAX((??)) - MIN((??))) AS ??`, [
          column_query,
          column_query,
          column.id,
        ]);
        break;
      case NumericalAggregations.Median:
        aggregationSql = knex.raw(
          `(
        SELECT AVG((??))
        FROM (
          SELECT (??)
          FROM ??
          ORDER BY (??)
          LIMIT 2 - (SELECT COUNT(*) FROM ??) % 2    -- Handle even/odd number of rows
          OFFSET (SELECT (COUNT(*) - 1) / 2 FROM ??) -- Calculate the median offset
        )
      ) AS ??`,
          [
            column_query,
            column_query,
            baseModelSqlv2.tnPath,
            column_query,
            baseModelSqlv2.tnPath,
            baseModelSqlv2.tnPath,
            column.id,
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
          `SUM(CASE WHEN ?? = 1 THEN 1 ELSE 0 END) AS ??`,
          [column_query, column.id],
        );
        break;
      case BooleanAggregations.Unchecked:
        aggregationSql = knex.raw(
          `SUM(CASE WHEN ?? = 0 OR ?? IS NULL THEN 1 ELSE 0 END) AS ??`,
          [column_query, column_query, column.id],
        );
        break;
      case BooleanAggregations.PercentChecked:
        aggregationSql = knex.raw(
          `(SUM(CASE WHEN ?? = 1 THEN 1 ELSE 0 END) * 100.0 / IFNULL(COUNT(*), 0)) AS ??`,
          [column_query, column.id],
        );
        break;
      case BooleanAggregations.PercentUnchecked:
        aggregationSql = knex.raw(
          `(SUM(CASE WHEN ?? = 0 OR ?? IS NULL THEN 1 ELSE 0 END) * 100.0 / IFNULL(COUNT(*), 0)) AS ??`,
          [column_query, column_query, column.id],
        );
        break;
      default:
        break;
    }
  } else if (aggType === 'date') {
    switch (aggregation) {
      case DateAggregations.EarliestDate:
        aggregationSql = knex.raw(`MIN(??) AS ??`, [column_query, column.id]);
        break;
      case DateAggregations.LatestDate:
        aggregationSql = knex.raw(`MAX(??) AS ??`, [column_query, column.id]);
        break;
      case DateAggregations.DateRange:
        aggregationSql = knex.raw(
          `CAST(JULIANDAY(MAX(??)) - JULIANDAY(MIN(??)) AS INTEGER) AS ??`,
          [column_query, column_query, column.id],
        );
        break;
      case DateAggregations.MonthRange:
        aggregationSql = knex.raw(
          `((strftime('%Y', MAX(??)) * 12 + strftime('%m', MAX(??))) - 
        (strftime('%Y', MIN(??)) * 12 + strftime('%m', MIN(??)))) AS ??`,
          [column_query, column_query, column_query, column_query, column.id],
        );
        break;
      default:
        break;
    }
  } else if (aggType === 'attachment') {
    switch (aggregation) {
      case AttachmentAggregations.AttachmentSize:
        aggregationSql = knex.raw(
          `(SELECT SUM(CAST(json_extract(value, '$.size') AS INTEGER)) 
       FROM ??, json_each(??)) AS ??`,
          [baseModelSqlv2.tnPath, column_query, column.id],
        );
        break;
      default:
        break;
    }
  }

  return aggregationSql?.toQuery();
}
