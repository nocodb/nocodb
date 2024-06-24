import UITypes from './UITypes';
import { FormulaDataTypes } from '~/lib/formulaHelpers';

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
    case UITypes.Attachment:
      returnAggregations = [
        ...Object.values(AttachmentAggregations),
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
  }

  if (!returnAggregations.length) {
    returnAggregations = [...Object.values(CommonAggregations)];
  }

  return returnAggregations.filter((item) => item !== CommonAggregations.Count);
};

export {
  getAvailableAggregations,
  NumericalAggregations,
  CommonAggregations,
  BooleanAggregations,
  DateAggregations,
  AttachmentAggregations,
  AllAggregations,
};
