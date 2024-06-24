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
  column,
  baseModelSqlv2,
  aggregation,
  column_query,
  parsedFormulaType,
  aggType,
}: {
  column: Column;
  column_query: string;
  baseModelSqlv2: BaseModelSqlv2;
  aggregation: string;
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
            `COUNT(*) FILTER (WHERE (??) IS NULL) AS ??`,
            [column_query, column.id],
          );
          break;
        }
        aggregationSql = knex.raw(
          `COUNT(*) FILTER (WHERE (??) IS NULL OR (??) = ${secondaryCondition}) AS ??`,
          [column_query, column_query, column.id],
        );

        break;
      case CommonAggregations.CountFilled:
        // The condition IS NOT NULL AND (column_query) != 'NULL' is not same for the following column_query types:
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
          ].includes(column.uidt) ||
          [FormulaDataTypes.DATE, FormulaDataTypes.NUMERIC].includes(
            parsedFormulaType,
          )
        ) {
          aggregationSql = knex.raw(
            `COUNT(*) FILTER (WHERE (??) IS NOT NULL) AS ??`,
            [column_query, column.id],
          );
          break;
        }

        // For other column_query types, the condition is IS NOT NULL AND (column_query) != 'NULL'
        aggregationSql = knex.raw(
          `COUNT(*) FILTER (WHERE (??) IS NOT NULL AND (??) != ${secondaryCondition}) AS ??`,
          [column_query, column_query, column.id],
        );
        break;
      case CommonAggregations.CountUnique:
        // JSON Does not support DISTINCT for json column_query type. Hence we need to cast the column_query to text.
        if ([UITypes.JSON].includes(column.uidt)) {
          aggregationSql = knex.raw(
            `COUNT(DISTINCT ((??)::text)) FILTER (WHERE (??) IS NOT NULL) AS ??`,
            [column_query, column_query, column.id],
          );
          break;
        }
        // The condition IS NOT NULL AND (column_query) != 'NULL' is not same for the following column_query types:
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
          ].includes(column.uidt) ||
          [FormulaDataTypes.DATE, FormulaDataTypes.NUMERIC].includes(
            parsedFormulaType,
          )
        ) {
          aggregationSql = knex.raw(
            `COUNT(DISTINCT (??)) FILTER (WHERE (??) IS NOT NULL) AS ??`,
            [column_query, column_query, column.id],
          );
          break;
        }
        aggregationSql = knex.raw(
          `COUNT(DISTINCT (??)) FILTER (WHERE (??) IS NOT NULL AND (??) != ${secondaryCondition}) AS ??`,
          [column_query, column_query, column_query, column.id],
        );
        break;
      case CommonAggregations.PercentEmpty:
        if ([UITypes.JSON].includes(column.uidt)) {
          aggregationSql = knex.raw(
            `(COUNT(*) FILTER (WHERE (??) IS NULL) * 100.0 / NULLIF(COUNT(*), 0)) AS ??`,
            [column_query, column.id],
          );
          break;
        }
        aggregationSql = knex.raw(
          `(COUNT(*) FILTER (WHERE (??) IS NULL OR (??) = ${secondaryCondition}) * 100.0 / NULLIF(COUNT(*), 0)) AS ??`,
          [column_query, column_query, column.id],
        );
        break;
      case CommonAggregations.PercentFilled:
        // The condition IS NOT NULL AND (column_query) != 'NULL' is not same for the following column_query types:
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
          ].includes(column.uidt) ||
          [FormulaDataTypes.DATE, FormulaDataTypes.NUMERIC].includes(
            parsedFormulaType,
          )
        ) {
          aggregationSql = knex.raw(
            `(COUNT(*) FILTER (WHERE (??) IS NOT NULL) * 100.0 / NULLIF(COUNT(*), 0)) AS ??`,
            [column_query, column.id],
          );
          break;
        }
        aggregationSql = knex.raw(
          `(COUNT(*) FILTER (WHERE (??) IS NOT NULL AND (??) != ${secondaryCondition}) * 100.0 / NULLIF(COUNT(*), 0)) AS ??`,
          [column_query, column_query, column.id],
        );
        break;
      case CommonAggregations.PercentUnique:
        // JSON Does not support DISTINCT for json column_query type. Hence we need to cast the column_query to text.
        if ([UITypes.JSON].includes(column.uidt)) {
          aggregationSql = knex.raw(
            `(COUNT(DISTINCT ((??)::text)) FILTER (WHERE (??) IS NOT NULL) * 100.0 / NULLIF(COUNT(*), 0)) AS ??`,
            [column_query, column_query, column.id],
          );
          break;
        }
        // The condition IS NOT NULL AND (column_query) != 'NULL' is not same for the following column_query types:
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
          ].includes(column.uidt) ||
          [FormulaDataTypes.DATE, FormulaDataTypes.NUMERIC].includes(
            parsedFormulaType,
          )
        ) {
          aggregationSql = knex.raw(
            `(COUNT(DISTINCT (??)) FILTER (WHERE (??) IS NOT NULL) * 100.0 / NULLIF(COUNT(*), 0)) AS ??`,
            [column_query, column_query, column.id],
          );
          break;
        }
        aggregationSql = knex.raw(
          `(COUNT(DISTINCT (??)) FILTER (WHERE (??) IS NOT NULL AND (??) != ${secondaryCondition}) * 100.0 / NULLIF(COUNT(*), 0)) AS ??`,
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
            `AVG((??)) FILTER (WHERE (??) != ??) AS ??`,
            [column_query, column_query, secondaryCondition, column.id],
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
            `MIN((??)) FILTER (WHERE (??) != ??) AS ??`,
            [column_query, column_query, secondaryCondition, column.id],
          );
          break;
        }

        aggregationSql = knex.raw(`MIN((??)) AS ??`, [column_query, column.id]);
        break;
      case NumericalAggregations.Sum:
        aggregationSql = knex.raw(`SUM((??)) AS ??`, [column_query, column.id]);
        break;
      case NumericalAggregations.StandardDeviation:
        if (column.uidt === UITypes.Rating) {
          aggregationSql = knex.raw(
            `stddev_pop((??)) FILTER (WHERE (??) != ??) AS ??`,
            [column_query, column_query, secondaryCondition, column.id],
          );
          break;
        }
        aggregationSql = knex.raw(`stddev_pop((??)) AS ??`, [
          column_query,
          column.id,
        ]);
        break;
      case NumericalAggregations.Range:
        aggregationSql = knex.raw(`MAX((??)) - MIN((??)) AS ??`, [
          column_query,
          column_query,
          column.id,
        ]);
        break;

      case NumericalAggregations.Median:
        aggregationSql = knex.raw(
          `percentile_cont(0.5) within group (order by (??)) AS ??`,
          [column_query, column.id],
        );
        break;
      default:
        break;
    }
  } else if (aggType === 'boolean') {
    switch (aggregation) {
      case BooleanAggregations.Checked:
        aggregationSql = knex.raw(`COUNT(*) FILTER (WHERE (??) = true) AS ??`, [
          column_query,
          column.id,
        ]);
        break;
      case BooleanAggregations.Unchecked:
        aggregationSql = knex.raw(
          `COUNT(*) FILTER (WHERE (??) = false OR (??) = NULL) AS ??`,
          [column_query, column_query, column.id],
        );
        break;
      case BooleanAggregations.PercentChecked:
        aggregationSql = knex.raw(
          `(COUNT(*) FILTER (WHERE (??) = true) * 100.0 / NULLIF(COUNT(*), 0)) AS ??`,
          [column_query, column.id],
        );
        break;
      case BooleanAggregations.PercentUnchecked:
        aggregationSql = knex.raw(
          `(COUNT(*) FILTER (WHERE (??) = false OR (??) = NULL) * 100.0 / NULLIF(COUNT(*), 0)) AS ??`,
          [column_query, column_query, column.id],
        );
        break;
      default:
        break;
    }
  } else if (aggType === 'date') {
    switch (aggregation) {
      case DateAggregations.EarliestDate:
        aggregationSql = knex.raw(`MIN((??)) AS ??`, [column_query, column.id]);
        break;
      case DateAggregations.LatestDate:
        aggregationSql = knex.raw(`MAX((??)) AS ??`, [column_query, column.id]);
        break;

      // The Date, DateTime, CreatedTime, LastModifiedTime columns are casted to DATE.
      case DateAggregations.DateRange:
        aggregationSql = knex.raw(`MAX((??)::date) - MIN((??)::date) AS ??`, [
          column_query,
          column_query,
          column.id,
        ]);
        break;
      // The Date, DateTime, CreatedTime, LastModifiedTime columns are casted to DATE.
      case DateAggregations.MonthRange:
        aggregationSql = knex.raw(
          `DATE_PART('year', AGE(MAX((??)::date), MIN((??)::date))) * 12 + 
         DATE_PART('month', AGE(MAX((??)::date), MIN((??)::date))) AS ??`,
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
          `(SELECT SUM((json_object ->> 'size')::int) FROM ?? CROSS JOIN LATERAL jsonb_array_elements(??::jsonb) AS json_array(json_object)) AS ??`,
          [baseModelSqlv2.tnPath, column_query, column.id],
        );
        break;
    }
  }

  return aggregationSql?.toQuery();
}
