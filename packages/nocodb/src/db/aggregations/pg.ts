import {
  AttachmentAggregations,
  BooleanAggregations,
  CommonAggregations,
  DateAggregations,
  FormulaDataTypes,
  NumericalAggregations,
  UITypes,
} from 'nocodb-sdk';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { Knex } from 'knex';
import type { Column } from '~/models';

export function genPgAggregateQuery({
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
            `COUNT(*) FILTER (WHERE (??) IS NULL) AS ??`,
            [column, _column.id],
          );
          break;
        }
        aggregationSql = knex.raw(
          `COUNT(*) FILTER (WHERE (??) IS NULL OR (??) = ${secondaryCondition}) AS ??`,
          [column, column, _column.id],
        );

        break;
      case CommonAggregations.CountFilled:
        // The condition IS NOT NULL AND (column) != 'NULL' is not same for the following column types:
        // Hence we need to handle them separately.
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
            `COUNT(*) FILTER (WHERE (??) IS NOT NULL) AS ??`,
            [column, _column.id],
          );
          break;
        }

        // For other column types, the condition is IS NOT NULL AND (column) != 'NULL'
        aggregationSql = knex.raw(
          `COUNT(*) FILTER (WHERE (??) IS NOT NULL AND (??) != ${secondaryCondition}) AS ??`,
          [column, column, _column.id],
        );
        break;
      case CommonAggregations.CountUnique:
        // JSON Does not support DISTINCT for json column type. Hence we need to cast the column to text.
        if ([UITypes.JSON].includes(_column.uidt)) {
          aggregationSql = knex.raw(
            `COUNT(DISTINCT ((??)::text)) FILTER (WHERE (??) IS NOT NULL) AS ??`,
            [column, column, _column.id],
          );
          break;
        }
        // The condition IS NOT NULL AND (column) != 'NULL' is not same for the following column types:
        // Hence we need to handle them separately.
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
            `COUNT(DISTINCT (??)) FILTER (WHERE (??) IS NOT NULL) AS ??`,
            [column, column, _column.id],
          );
          break;
        }
        aggregationSql = knex.raw(
          `COUNT(DISTINCT (??)) FILTER (WHERE (??) IS NOT NULL AND (??) != ${secondaryCondition}) AS ??`,
          [column, column, column, _column.id],
        );
        break;
      case CommonAggregations.PercentEmpty:
        if ([UITypes.JSON].includes(_column.uidt)) {
          aggregationSql = knex.raw(
            `(COUNT(*) FILTER (WHERE (??) IS NULL) * 100.0 / NULLIF(COUNT(*), 0)) AS ??`,
            [column, _column.id],
          );
          break;
        }
        aggregationSql = knex.raw(
          `(COUNT(*) FILTER (WHERE (??) IS NULL OR (??) = ${secondaryCondition}) * 100.0 / NULLIF(COUNT(*), 0)) AS ??`,
          [column, column, _column.id],
        );
        break;
      case CommonAggregations.PercentFilled:
        // The condition IS NOT NULL AND (column) != 'NULL' is not same for the following column types:
        // Hence we need to handle them separately.
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
            `(COUNT(*) FILTER (WHERE (??) IS NOT NULL) * 100.0 / NULLIF(COUNT(*), 0)) AS ??`,
            [column, _column.id],
          );
          break;
        }
        aggregationSql = knex.raw(
          `(COUNT(*) FILTER (WHERE (??) IS NOT NULL AND (??) != ${secondaryCondition}) * 100.0 / NULLIF(COUNT(*), 0)) AS ??`,
          [column, column, _column.id],
        );
        break;
      case CommonAggregations.PercentUnique:
        // JSON Does not support DISTINCT for json column type. Hence we need to cast the column to text.
        if ([UITypes.JSON].includes(_column.uidt)) {
          aggregationSql = knex.raw(
            `(COUNT(DISTINCT ((??)::text)) FILTER (WHERE (??) IS NOT NULL) * 100.0 / NULLIF(COUNT(*), 0)) AS ??`,
            [column, column, _column.id],
          );
          break;
        }
        // The condition IS NOT NULL AND (column) != 'NULL' is not same for the following column types:
        // Hence we need to handle them separately.
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
            `(COUNT(DISTINCT (??)) FILTER (WHERE (??) IS NOT NULL) * 100.0 / NULLIF(COUNT(*), 0)) AS ??`,
            [column, column, _column.id],
          );
          break;
        }
        aggregationSql = knex.raw(
          `(COUNT(DISTINCT (??)) FILTER (WHERE (??) IS NOT NULL AND (??) != ${secondaryCondition}) * 100.0 / NULLIF(COUNT(*), 0)) AS ??`,
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
            `AVG((??)) FILTER (WHERE (??) != ??) AS ??`,
            [column, column, secondaryCondition, _column.id],
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
            `MIN((??)) FILTER (WHERE (??) != ??) AS ??`,
            [column, column, secondaryCondition, _column.id],
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
          aggregationSql = knex.raw(
            `stddev_pop((??)) FILTER (WHERE (??) != ??) AS ??`,
            [column, column, secondaryCondition, _column.id],
          );
          break;
        }
        aggregationSql = knex.raw(`stddev_pop((??)) AS ??`, [
          column,
          _column.id,
        ]);
        break;
      case NumericalAggregations.Range:
        aggregationSql = knex.raw(`MAX((??)) - MIN((??)) AS ??`, [
          column,
          column,
          _column.id,
        ]);
        break;

      case NumericalAggregations.Median:
        aggregationSql = knex.raw(
          `percentile_cont(0.5) within group (order by (??)) AS ??`,
          [column, _column.id],
        );
        break;
      default:
        break;
    }
  } else if (aggType === 'boolean') {
    switch (aggregation) {
      case BooleanAggregations.Checked:
        aggregationSql = knex.raw(`COUNT(*) FILTER (WHERE (??) = true) AS ??`, [
          column,
          _column.id,
        ]);
        break;
      case BooleanAggregations.Unchecked:
        aggregationSql = knex.raw(
          `COUNT(*) FILTER (WHERE (??) = false OR (??) = NULL) AS ??`,
          [column, column, _column.id],
        );
        break;
      case BooleanAggregations.PercentChecked:
        aggregationSql = knex.raw(
          `(COUNT(*) FILTER (WHERE (??) = true) * 100.0 / NULLIF(COUNT(*), 0)) AS ??`,
          [column, _column.id],
        );
        break;
      case BooleanAggregations.PercentUnchecked:
        aggregationSql = knex.raw(
          `(COUNT(*) FILTER (WHERE (??) = false OR (??) = NULL) * 100.0 / NULLIF(COUNT(*), 0)) AS ??`,
          [column, column, _column.id],
        );
        break;
      default:
        break;
    }
  } else if (aggType === 'date') {
    switch (aggregation) {
      case DateAggregations.EarliestDate:
        aggregationSql = knex.raw(`MIN((??)) AS ??`, [column, _column.id]);
        break;
      case DateAggregations.LatestDate:
        aggregationSql = knex.raw(`MAX((??)) AS ??`, [column, _column.id]);
        break;

      // The Date, DateTime, CreatedTime, LastModifiedTime columns are casted to DATE.
      case DateAggregations.DateRange:
        aggregationSql = knex.raw(`MAX((??)::date) - MIN((??)::date) AS ??`, [
          column,
          column,
          _column.id,
        ]);
        break;
      // The Date, DateTime, CreatedTime, LastModifiedTime columns are casted to DATE.
      case DateAggregations.MonthRange:
        aggregationSql = knex.raw(
          `DATE_PART('year', AGE(MAX((??)::date), MIN((??)::date))) * 12 + 
         DATE_PART('month', AGE(MAX((??)::date), MIN((??)::date))) AS ??`,
          [column, column, column, column, _column.id],
        );

        break;
      default:
        break;
    }
  } else if (aggType === 'attachment') {
    switch (aggregation) {
      case AttachmentAggregations.AttachmentSize:
        aggregationSql = knex.raw(
          `(SELECT SUM((json_object ->> 'size')::int) FROM ?? CROSS JOIN LATERAL jsonb_array_elements(??::jsonb) AS json_array(json_object)) AS ??`,
          [baseModelSqlv2.tnPath, column, _column.id],
        );
        break;
    }
  }

  return aggregationSql?.toQuery();
}
