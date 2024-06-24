import {
  AttachmentAggregations,
  BooleanAggregations,
  CommonAggregations,
  DateAggregations,
  getAvailableAggregations,
  NumericalAggregations,
  UITypes,
} from 'nocodb-sdk';
import type { Knex } from 'knex';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type { BarcodeColumn, QrCodeColumn, RollupColumn } from '~/models';
import { Column } from '~/models';
import { NcError } from '~/helpers/catchError';
import genRollupSelectv2 from '~/db/genRollupSelectv2';
import generateLookupSelectQuery from '~/db/generateLookupSelectQuery';

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

export default async function applyAggregation({
  baseModelSqlv2,
  aggregation,
  column: _column,
}: {
  baseModelSqlv2: BaseModelSqlv2;
  aggregation: string;
  column: Column;
}): Promise<string | undefined> {
  if (!aggregation) {
    aggregation = CommonAggregations.None;
  }

  if (!_column) {
    NcError.badRequest('Invalid aggregation');
  }

  const { context, dbDriver: knex, model } = baseModelSqlv2;

  /*
  All aggregations are not available for all UITypes. We validate the column type
  and the aggregation type to make sure that the aggregation is available for the column type.
  We also return the type of aggregation that has to be applied on the column.
  The return value can be one of the following:
  - common       - common aggregations like count, count empty, count filled, count unique, etc.
  - numerical    - numerical aggregations like sum, avg, min, max, etc.
  - boolean      - boolean aggregations like checked, unchecked, percent checked, percent unchecked, etc.
  - date         - date aggregations like earliest date, latest date, date range, month range, etc.
  - attachment   - attachment aggregations like attachment size.
  - unknown      - if the aggregation is not supported yet
  */
  const aggType = validateColType(_column, aggregation);

  let aggregationSql: Knex.Raw | undefined;

  // If the aggregation is not available for the column type, we throw an error.
  if (aggType === 'unknown') {
    NcError.notImplemented(`Aggregation ${aggregation} is not implemented yet`);
  }

  // If the column is a barcode or qr code column, we fetch the column that the virtual column refers to.
  if (_column.uidt === UITypes.Barcode || _column.uidt === UITypes.QrCode) {
    _column = new Column({
      ...(await _column
        .getColOptions<BarcodeColumn | QrCodeColumn>(context)
        .then((col) => col.getValueColumn(context))),
      id: _column.id,
    });
  }

  let column = _column.column_name;

  if (_column.uidt === UITypes.CreatedTime && !_column.column_name)
    column = 'created_at';
  if (_column.uidt === UITypes.LastModifiedTime && !_column.column_name)
    column = 'updated_at';
  if (_column.uidt === UITypes.CreatedBy && !_column.column_name)
    column = 'created_by';
  if (_column.uidt === UITypes.LastModifiedBy && !_column.column_name)
    column = 'updated_by';

  /* The following column types require special handling for aggregation:
   * - Links
   * - Rollup
   * - Formula
   * - Lookup
   * - LinkToAnotherRecord
   * These column types require special handling because they are virtual columns and do not have a direct column name.
   * We generate the select query for these columns and use the generated query for aggregation.
   * */
  switch (_column.uidt) {
    case UITypes.Links:
    case UITypes.Rollup:
      column = (
        await genRollupSelectv2({
          baseModelSqlv2,
          knex,
          columnOptions: (await _column.getColOptions(context)) as RollupColumn,
        })
      ).builder;
      break;

    case UITypes.Formula:
      column = (await baseModelSqlv2.getSelectQueryBuilderForFormula(_column))
        .builder;
      break;

    case UITypes.LinkToAnotherRecord:
    case UITypes.Lookup:
      column = (
        await generateLookupSelectQuery({
          baseModelSqlv2,
          column: _column,
          alias: null,
          model,
        })
      ).builder;
      break;
  }
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
    ].includes(_column.uidt)
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
          ].includes(_column.uidt)
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
          ].includes(_column.uidt)
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
          ].includes(_column.uidt)
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
          ].includes(_column.uidt)
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
            `STDDEV((??)) FILTER (WHERE (??) != ??) AS ??`,
            [column, column, secondaryCondition, _column.id],
          );
          break;
        }
        aggregationSql = knex.raw(`STDDEV((??)) AS ??`, [column, _column.id]);
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

      // The Date, DateTime, CreatedTime, LastModifiedTime columns are casted as DATE in the database.
      case DateAggregations.DateRange:
        aggregationSql = knex.raw(`MAX((??)::date) - MIN((??)::date) AS ??`, [
          column,
          column,
          _column.id,
        ]);
        break;
      // The Date, DateTime, CreatedTime, LastModifiedTime columns are casted as DATE in the database.
      case DateAggregations.MonthRange:
        aggregationSql = knex.raw(
          `EXTRACT(MONTH FROM MAX((??)::date)) - EXTRACT(MONTH FROM MIN((??)::date)) AS ??`,
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
          `(SELECT SUM((json_object ->> 'size')::int) FROM ?? CROSS JOIN LATERAL jsonb_array_elements(??::jsonb) AS json_array(json_object)) AS ??`,
          [baseModelSqlv2.tnPath, column, _column.id],
        );
        break;
    }
  }

  return aggregationSql?.toQuery();
}
