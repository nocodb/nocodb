import {
  AttachmentAggregations,
  BooleanAggregations,
  CommonAggregations,
  DateAggregations,
  getAvailableAggregations,
  NumericalAggregations,
} from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { Column } from '~/models';
import { NcError } from '~/helpers/catchError';

const validateColType = (column: Column, aggregation: string) => {
  const agg = getAvailableAggregations(column.uidt);

  if (!agg.includes(aggregation)) {
    NcError.badRequest(
      `Aggregation ${aggregation} is not available for column type ${column.uidt}`,
    );
  }

  if (
    Object.values(BooleanAggregations).includes(
      aggregation as BooleanAggregations,
    )
  ) {
    return 'boolean';
  }

  if (
    Object.values(CommonAggregations).includes(
      aggregation as CommonAggregations,
    )
  ) {
    return 'common';
  }

  if (
    Object.values(DateAggregations).includes(aggregation as DateAggregations)
  ) {
    return 'date';
  }

  if (
    Object.values(NumericalAggregations).includes(
      aggregation as NumericalAggregations,
    )
  ) {
    return 'numerical';
  }

  if (
    Object.values(AttachmentAggregations).includes(
      aggregation as AttachmentAggregations,
    )
  ) {
    return 'attachment';
  }

  return 'unknown';
};

export default function applyAggregation(
  baseModelSqlv2: BaseModelSqlv2,
  qb: Knex.QueryBuilder,
  aggregation: string,
  column: Column,
) {
  if (!aggregation) {
    aggregation = CommonAggregations.None;
  }

  if (!column) {
    NcError.badRequest('Invalid aggregation');
  }

  const aggType = validateColType(column, aggregation);

  let aggregationSql: Knex.Raw | undefined;

  if (aggType === 'unknown') {
    NcError.notImplemented(`Aggregation ${aggregation} is not implemented yet`);
  }

  if (aggType === 'common') {
    switch (aggregation) {
      case CommonAggregations.CountEmpty:
        aggregationSql = baseModelSqlv2.dbDriver.raw(
          `COUNT(*) FILTER (WHERE ?? IS NULL) AS ??`,
          [column.column_name, column.id],
        );
        break;
      case CommonAggregations.CountFilled:
        aggregationSql = baseModelSqlv2.dbDriver.raw(
          `COUNT(*) FILTER (WHERE ?? IS NOT NULL) AS ??`,
          [column.column_name, column.id],
        );
        break;
      case CommonAggregations.CountUnique:
        aggregationSql = baseModelSqlv2.dbDriver.raw(
          `COUNT(DISTINCT ??) AS ??`,
          [column.column_name, column.id],
        );
        break;
      case CommonAggregations.PercentEmpty:
        aggregationSql = baseModelSqlv2.dbDriver.raw(
          `(COUNT(*) FILTER (WHERE ?? IS NULL) * 100.0 / COUNT(*)) AS ??`,
          [column.column_name, column.id],
        );
        break;
      case CommonAggregations.PercentFilled:
        aggregationSql = baseModelSqlv2.dbDriver.raw(
          `(COUNT(*) FILTER (WHERE ?? IS NOT NULL) * 100.0 / COUNT(*)) AS ??`,
          [column.column_name, column.id],
        );
        break;
      case CommonAggregations.PercentUnique:
        aggregationSql = baseModelSqlv2.dbDriver.raw(
          `(COUNT(DISTINCT ?? ) * 100.0 / COUNT(*)) AS ??`,
          [column.column_name, column.id],
        );
        break;
      case CommonAggregations.None:
        break;
    }
  } else if (aggType === 'numerical') {
    switch (aggregation) {
      case NumericalAggregations.Avg:
        aggregationSql = baseModelSqlv2.dbDriver.raw(`AVG(??) AS ??`, [
          column.column_name,
          column.id,
        ]);
        break;
      case NumericalAggregations.Max:
        aggregationSql = baseModelSqlv2.dbDriver.raw(`MAX(??) AS ??`, [
          column.column_name,
          column.id,
        ]);
        break;
      case NumericalAggregations.Min:
        aggregationSql = baseModelSqlv2.dbDriver.raw(`MIN(??) AS ??`, [
          column.column_name,
          column.id,
        ]);
        break;
      case NumericalAggregations.Sum:
        aggregationSql = baseModelSqlv2.dbDriver.raw(`SUM(??) AS ??`, [
          column.column_name,
          column.id,
        ]);
        break;
      case NumericalAggregations.StandardDeviation:
        aggregationSql = baseModelSqlv2.dbDriver.raw(`STDDEV(??) AS ??`, [
          column.column_name,
          column.id,
        ]);
        break;
      case NumericalAggregations.Range:
        aggregationSql = baseModelSqlv2.dbDriver.raw(
          `MAX(??) - MIN(??) AS ??`,
          [column.column_name, column.column_name, column.id],
        );
        break;

      case NumericalAggregations.Median:
        aggregationSql = baseModelSqlv2.dbDriver.raw(
          `percentile_cont(0.5) within group (order by ??) AS ??`,
          [column.column_name, column.id],
        );
        break;
      default:
        break;
    }
  } else if (aggType === 'boolean') {
    switch (aggregation) {
      case BooleanAggregations.Checked:
        aggregationSql = baseModelSqlv2.dbDriver.raw(
          `COUNT(*) FILTER (WHERE ?? = true) AS ??`,
          [column.column_name, column.id],
        );
        break;
      case BooleanAggregations.Unchecked:
        aggregationSql = baseModelSqlv2.dbDriver.raw(
          `COUNT(*) FILTER (WHERE ?? = false) AS ??`,
          [column.column_name, column.id],
        );
        break;
      case BooleanAggregations.PercentChecked:
        aggregationSql = baseModelSqlv2.dbDriver.raw(
          `(COUNT(*) FILTER (WHERE ?? = true) * 100.0 / COUNT(*)) AS ??`,
          [column.column_name, column.id],
        );
        break;
      case BooleanAggregations.PercentUnchecked:
        aggregationSql = baseModelSqlv2.dbDriver.raw(
          `(COUNT(*) FILTER (WHERE ?? = false) * 100.0 / COUNT(*)) AS ??`,
          [column.column_name, column.id],
        );
        break;
      default:
        break;
    }
  } else if (aggType === 'date') {
    switch (aggregation) {
      case DateAggregations.EarliestDate:
        aggregationSql = baseModelSqlv2.dbDriver.raw(`MIN(??) AS ??`, [
          column.column_name,
          column.id,
        ]);
        break;
      case DateAggregations.LatestDate:
        aggregationSql = baseModelSqlv2.dbDriver.raw(`MAX(??) AS ??`, [
          column.column_name,
          column.id,
        ]);
        break;
      case DateAggregations.DateRange:
        aggregationSql = baseModelSqlv2.dbDriver.raw(
          `MAX(??) - MIN(??) AS ??`,
          [column.column_name, column.column_name, column.id],
        );
        break;
      case DateAggregations.MonthRange:
        aggregationSql = baseModelSqlv2.dbDriver.raw(
          `EXTRACT(MONTH FROM MAX(??::timestamptz)) - EXTRACT(MONTH FROM MIN(??::timestamptz)) AS ??`,
          [column.column_name, column.column_name, column.id],
        );
        break;
      default:
        break;
    }
  } else if (aggType === 'attachment') {
    // TODO: Verify Performance
    switch (aggregation) {
      case AttachmentAggregations.AttachmentSize:
        aggregationSql = baseModelSqlv2.dbDriver.raw(
          `(SELECT SUM((json_object ->> 'size')::int) FROM ?? CROSS JOIN LATERAL jsonb_array_elements(??::jsonb) AS json_array(json_object)) AS ??`,
          [baseModelSqlv2.tnPath, column.column_name, column.id],
        );
        break;
    }
  }

  return aggregationSql;
}
