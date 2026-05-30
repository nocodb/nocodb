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
import type { Knex } from 'knex';
import type { Column } from '~/models';
import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';

export function genPgAggregateQuery({
  column,
  baseModelSqlv2,
  aggregation,
  column_query,
  parsedFormulaType,
  aggType,
  alias,
}: {
  column: Column;
  column_query: string | Knex.QueryBuilder;
  baseModelSqlv2: IBaseModelSqlV2;
  aggregation: string;
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
  // Native PG enum columns reject '' with "invalid input value for enum",
  // and an enum cell can't hold '' anyway — IS NULL alone covers "empty".
  const isNativePgEnum = !!column.internal_meta?.pg_enum_type_name;
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
      UITypes.AutoNumber,
      UITypes.UUID,
    ].includes(column.uidt) ||
    [FormulaDataTypes.DATE, FormulaDataTypes.NUMERIC].includes(
      parsedFormulaType,
    ) ||
    isNativePgEnum
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
          aggregationSql = knex.raw(`COUNT(*) FILTER (WHERE (??) IS NULL)`, [
            column_query,
          ]);
          break;
        }
        aggregationSql = knex.raw(
          `COUNT(*) FILTER (WHERE (??) IS NULL OR (??) = ${condnValue})`,
          [column_query, column_query],
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
            UITypes.AutoNumber,
            UITypes.UUID,
            UITypes.LinkToAnotherRecord,
            UITypes.Lookup,
          ].includes(column.uidt) ||
          [FormulaDataTypes.DATE, FormulaDataTypes.NUMERIC].includes(
            parsedFormulaType,
          )
        ) {
          aggregationSql = knex.raw(
            `COUNT(*) FILTER (WHERE (??) IS NOT NULL)`,
            [column_query],
          );
          break;
        }

        // For other column_query types, the condition is IS NOT NULL AND (column_query) != 'NULL'
        aggregationSql = knex.raw(
          `COUNT(*) FILTER (WHERE (??) IS NOT NULL AND (??) != ${condnValue})`,
          [column_query, column_query],
        );
        break;
      case CommonAggregations.CountUnique:
        // JSON Does not support DISTINCT for json column_query type. Hence we need to cast the column_query to text.
        if ([UITypes.JSON].includes(column.uidt)) {
          aggregationSql = knex.raw(
            `COUNT(DISTINCT ((??)::text)) FILTER (WHERE (??) IS NOT NULL)`,
            [column_query, column_query],
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
            UITypes.AutoNumber,
            UITypes.UUID,
            UITypes.LinkToAnotherRecord,
            UITypes.Lookup,
          ].includes(column.uidt) ||
          [FormulaDataTypes.DATE, FormulaDataTypes.NUMERIC].includes(
            parsedFormulaType,
          )
        ) {
          aggregationSql = knex.raw(
            `COUNT(DISTINCT (??)) FILTER (WHERE (??) IS NOT NULL)`,
            [column_query, column_query],
          );
          break;
        }
        aggregationSql = knex.raw(
          `COUNT(DISTINCT (??)) FILTER (WHERE (??) IS NOT NULL AND (??) != ${condnValue})`,
          [column_query, column_query, column_query],
        );
        break;
      case CommonAggregations.PercentEmpty:
        if ([UITypes.JSON].includes(column.uidt)) {
          aggregationSql = knex.raw(
            `(COUNT(*) FILTER (WHERE (??) IS NULL) * 100.0 / NULLIF(COUNT(*), 0))`,
            [column_query],
          );
          break;
        }
        aggregationSql = knex.raw(
          `(COUNT(*) FILTER (WHERE (??) IS NULL OR (??) = ${condnValue}) * 100.0 / NULLIF(COUNT(*), 0))`,
          [column_query, column_query],
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
            UITypes.AutoNumber,
            UITypes.UUID,
            UITypes.LinkToAnotherRecord,
            UITypes.Lookup,
          ].includes(column.uidt) ||
          [FormulaDataTypes.DATE, FormulaDataTypes.NUMERIC].includes(
            parsedFormulaType,
          )
        ) {
          aggregationSql = knex.raw(
            `(COUNT(*) FILTER (WHERE (??) IS NOT NULL) * 100.0 / NULLIF(COUNT(*), 0))`,
            [column_query],
          );
          break;
        }
        aggregationSql = knex.raw(
          `(COUNT(*) FILTER (WHERE (??) IS NOT NULL AND (??) != ${condnValue}) * 100.0 / NULLIF(COUNT(*), 0))`,
          [column_query, column_query],
        );
        break;
      case CommonAggregations.PercentUnique:
        // JSON Does not support DISTINCT for json column_query type. Hence we need to cast the column_query to text.
        if ([UITypes.JSON].includes(column.uidt)) {
          aggregationSql = knex.raw(
            `(COUNT(DISTINCT ((??)::text)) FILTER (WHERE (??) IS NOT NULL) * 100.0 / NULLIF(COUNT(*), 0))`,
            [column_query, column_query],
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
            UITypes.AutoNumber,
            UITypes.UUID,
            UITypes.LinkToAnotherRecord,
            UITypes.Lookup,
          ].includes(column.uidt) ||
          [FormulaDataTypes.DATE, FormulaDataTypes.NUMERIC].includes(
            parsedFormulaType,
          )
        ) {
          aggregationSql = knex.raw(
            `(COUNT(DISTINCT (??)) FILTER (WHERE (??) IS NOT NULL) * 100.0 / NULLIF(COUNT(*), 0))`,
            [column_query, column_query],
          );
          break;
        }
        aggregationSql = knex.raw(
          `(COUNT(DISTINCT (??)) FILTER (WHERE (??) IS NOT NULL AND (??) != ${condnValue}) * 100.0 / NULLIF(COUNT(*), 0))`,
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
          aggregationSql = knex.raw(`AVG((??)) FILTER (WHERE (??) != ??)`, [
            column_query,
            column_query,
            condnValue,
          ]);
          break;
        }
        aggregationSql = knex.raw(`AVG((??))`, [column_query]);
        break;
      case NumericalAggregations.Max:
        aggregationSql = knex.raw(`MAX((??))`, [column_query]);
        break;
      case NumericalAggregations.Min:
        if (column.uidt === UITypes.Rating) {
          aggregationSql = knex.raw(`MIN((??)) FILTER (WHERE (??) != ??)`, [
            column_query,
            column_query,
            condnValue,
          ]);
          break;
        }

        aggregationSql = knex.raw(`MIN((??))`, [column_query]);
        break;
      case NumericalAggregations.Sum:
        aggregationSql = knex.raw(`SUM((??))`, [column_query]);
        break;
      case NumericalAggregations.StandardDeviation:
        if (column.uidt === UITypes.Rating) {
          aggregationSql = knex.raw(
            `stddev_pop((??)) FILTER (WHERE (??) != ??) `,
            [column_query, column_query, condnValue],
          );
          break;
        }
        aggregationSql = knex.raw(`stddev_pop((??))`, [column_query]);
        break;
      case NumericalAggregations.Range:
        if (column.uidt === UITypes.Rating) {
          // FILTER binds to the immediately preceding aggregate, so this is
          // MAX(all) - (MIN(...) FILTER (WHERE ... != 0)). Intentional: Rating
          // treats 0 as "empty" for Min/Range but counts it for Max — matches
          // the JS reducer in nocodb-sdk/aggregationCompute.ts.
          aggregationSql = knex.raw(
            `MAX((??)) - MIN((??)) FILTER (WHERE (??) != ??)`,
            [column_query, column_query, column_query, condnValue],
          );
          break;
        }
        aggregationSql = knex.raw(`MAX((??)) - MIN((??))`, [
          column_query,
          column_query,
        ]);
        break;

      case NumericalAggregations.Median:
        aggregationSql = knex.raw(
          `percentile_cont(0.5) within group (order by (??))`,
          [column_query],
        );
        break;
      default:
        break;
    }
  } else if (aggType === 'boolean') {
    switch (aggregation) {
      case BooleanAggregations.Checked:
        aggregationSql = knex.raw(`COUNT(*) FILTER (WHERE (??) = true)`, [
          column_query,
        ]);
        break;
      case BooleanAggregations.Unchecked:
        aggregationSql = knex.raw(
          `COUNT(*) FILTER (WHERE (??) = false OR (??) = NULL)`,
          [column_query, column_query],
        );
        break;
      case BooleanAggregations.PercentChecked:
        aggregationSql = knex.raw(
          `(COUNT(*) FILTER (WHERE (??) = true) * 100.0 / NULLIF(COUNT(*), 0))`,
          [column_query],
        );
        break;
      case BooleanAggregations.PercentUnchecked:
        aggregationSql = knex.raw(
          `(COUNT(*) FILTER (WHERE (??) = false OR (??) = NULL) * 100.0 / NULLIF(COUNT(*), 0))`,
          [column_query, column_query],
        );
        break;
      default:
        break;
    }
  } else if (aggType === 'date') {
    switch (aggregation) {
      case DateAggregations.EarliestDate:
        aggregationSql = knex.raw(`MIN((??))`, [column_query]);
        break;
      case DateAggregations.LatestDate:
        aggregationSql = knex.raw(`MAX((??))`, [column_query]);
        break;

      // The Date, DateTime, CreatedTime, LastModifiedTime columns are casted to DATE.
      case DateAggregations.DateRange:
        aggregationSql = knex.raw(`MAX((??)::date) - MIN((??)::date)`, [
          column_query,
          column_query,
        ]);
        break;
      // Calendar-month diff (matches SQLite / MySQL / JS reducer). AGE() would
      // return elapsed-time-in-whole-months instead, which is off by one when
      // the day-of-month of the max is earlier than the day-of-month of the min
      // (e.g. 2024-01-15 → 2025-01-01 is 11 months 17 days under AGE, but 12
      // calendar months apart).
      case DateAggregations.MonthRange:
        aggregationSql = knex.raw(
          `(EXTRACT(YEAR FROM MAX((??)::date)) * 12 + EXTRACT(MONTH FROM MAX((??)::date)))
         - (EXTRACT(YEAR FROM MIN((??)::date)) * 12 + EXTRACT(MONTH FROM MIN((??)::date)))`,
          [column_query, column_query, column_query, column_query],
        );
        break;
      default:
        break;
    }
  } else if (aggType === 'attachment') {
    switch (aggregation) {
      case AttachmentAggregations.AttachmentSize:
        aggregationSql = knex.raw(
          `SUM((SELECT COALESCE(SUM((json_object ->> 'size')::int), 0)FROM jsonb_array_elements(??::jsonb) AS json_array(json_object)))`,
          [column_query],
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
