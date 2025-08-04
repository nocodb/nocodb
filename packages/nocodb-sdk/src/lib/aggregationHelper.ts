import UITypes from './UITypes';
import { FormulaDataTypes } from '~/lib/formulaHelpers';
import type { ColumnType } from '~/lib/Api';
import { getDateTimeValue, getDateValue } from '~/lib/dateTimeHelper';
import { formatBytes, parseProp } from '~/lib/helperFunctions';
import { convertMS2Duration } from '~/lib/durationUtils';
import { getCurrencyValue, roundTo } from '~/lib/numberUtils';
import { SerializerOrParserFnProps } from './columnHelper/column.interface';
import { ColumnHelper } from './columnHelper';

enum NumericalAggregations {
  Sum = 'sum',
  Min = 'min',
  Max = 'max',
  Avg = 'avg',
  Median = 'median',
  StandardDeviation = 'std_dev',
  //   Histogram = 'histogram',
  Range = 'range',
}

enum CommonAggregations {
  Count = 'count',
  CountEmpty = 'count_empty',
  CountFilled = 'count_filled',
  CountUnique = 'count_unique',
  PercentEmpty = 'percent_empty',
  PercentFilled = 'percent_filled',
  PercentUnique = 'percent_unique',
  None = 'none',
}

enum AttachmentAggregations {
  AttachmentSize = 'attachment_size',
}

enum BooleanAggregations {
  Checked = 'checked',
  Unchecked = 'unchecked',
  PercentChecked = 'percent_checked',
  PercentUnchecked = 'percent_unchecked',
}

enum DateAggregations {
  EarliestDate = 'earliest_date',
  LatestDate = 'latest_date',
  DateRange = 'date_range',
  MonthRange = 'month_range',
}

const AllAggregations = {
  ...CommonAggregations,
  ...NumericalAggregations,
  ...AttachmentAggregations,
  ...BooleanAggregations,
  ...DateAggregations,
};

type AggregationValue = typeof AllAggregations[keyof typeof AllAggregations]

const getAvailableAggregations = (type: string, parsed_tree?): string[] => {
  let returnAggregations = [];
  if (type === UITypes.Formula && parsed_tree?.dataType) {
    switch (parsed_tree.dataType) {
      case FormulaDataTypes.BOOLEAN:
        returnAggregations = [
          ...Object.values(BooleanAggregations),
          CommonAggregations.None,
        ];
        break;
      case FormulaDataTypes.DATE:
        returnAggregations = [
          ...Object.values(DateAggregations),
          ...Object.values(CommonAggregations),
        ];
        break;
      case FormulaDataTypes.NUMERIC:
        returnAggregations = [
          ...Object.values(NumericalAggregations),
          ...Object.values(CommonAggregations),
        ];

        break;
      default:
        returnAggregations = [...Object.values(CommonAggregations)];
        break;
    }
  }

  switch (type) {
    case UITypes.Number:
    case UITypes.Decimal:
    case UITypes.Currency:
    case UITypes.Percent:
    case UITypes.Duration:
    case UITypes.Rating:
    case UITypes.Rollup:
    case UITypes.Links:
      returnAggregations = [
        ...Object.values(NumericalAggregations),
        ...Object.values(CommonAggregations),
      ];
      break;
    case UITypes.Checkbox:
      returnAggregations = [
        ...Object.values(BooleanAggregations),
        CommonAggregations.None,
      ];
      break;
    case UITypes.Date:
    case UITypes.DateTime:
    case UITypes.LastModifiedTime:
    case UITypes.CreatedTime:
      returnAggregations = [
        ...Object.values(DateAggregations),
        ...Object.values(CommonAggregations),
      ];
      break;
    case UITypes.SpecificDBType:
    case UITypes.ForeignKey:
      returnAggregations = [CommonAggregations.None];
      break;
    case UITypes.Button:
    case UITypes.Attachment:
      return [CommonAggregations.None];
  }

  if (!returnAggregations.length) {
    returnAggregations = [...Object.values(CommonAggregations)];
  }

  return returnAggregations.filter((item) => item !== CommonAggregations.Count);
};

const formatAggregation = (
  aggregation: any,
  value: any,
  column: ColumnType,
  /**
   * If columnHelperParams is provided then it will be used to format the aggregation value
   */
  columnHelperParams?: SerializerOrParserFnProps['params']
) => {
  if (
    [DateAggregations.EarliestDate, DateAggregations.LatestDate].includes(
      aggregation
    )
  ) {
    if (column.uidt === UITypes.DateTime) {
      return getDateTimeValue(value, column);
    } else if (column.uidt === UITypes.Date) {
      return getDateValue(value, column);
    }
    return getDateTimeValue(value, column);
  }

  if (
    [
      CommonAggregations.PercentEmpty,
      CommonAggregations.PercentFilled,
      CommonAggregations.PercentUnique,
      BooleanAggregations.PercentChecked,
      BooleanAggregations.PercentUnchecked,
    ].includes(aggregation)
  ) {
    return `${roundTo(value, 1) ?? 0}%`;
  }

  if (
    [DateAggregations.MonthRange, DateAggregations.DateRange].includes(
      aggregation
    )
  ) {
    return aggregation === DateAggregations.DateRange
      ? `${value ?? 0} days`
      : `${value ?? 0} months`;
  }

  if (
    [
      CommonAggregations.Count,
      CommonAggregations.CountEmpty,
      CommonAggregations.CountFilled,
      CommonAggregations.CountUnique,
    ].includes(aggregation)
  ) {
    return value;
  }

  if ([AttachmentAggregations.AttachmentSize].includes(aggregation)) {
    return formatBytes(value ?? 0);
  }

  if (
    columnHelperParams &&
    columnHelperParams?.col &&
    Object.values(NumericalAggregations).includes(aggregation) &&
    [
      UITypes.Number,
      UITypes.Decimal,
      UITypes.Currency,
      UITypes.Percent,
      UITypes.Duration,
      UITypes.Rollup,
    ].includes(column.uidt as UITypes)
  ) {
    return ColumnHelper.parsePlainCellValue(value, {
      ...columnHelperParams,
      isAggregation: true,
    });
  }

  if (column.uidt === UITypes.Currency) {
    return getCurrencyValue(value, column);
  }

  if (column.uidt === UITypes.Percent) {
    return `${roundTo(value, 1)}%`;
  }

  if (column.uidt === UITypes.Duration) {
    return convertMS2Duration(value, parseProp(column.meta)?.duration || 0);
  }
  if (typeof value === 'number') {
    return roundTo(value, 1) ?? '∞';
  }

  return value;
};

export {
  getAvailableAggregations,
  NumericalAggregations,
  CommonAggregations,
  BooleanAggregations,
  DateAggregations,
  AttachmentAggregations,
  AllAggregations,
  formatAggregation,
  AggregationValue,
};
