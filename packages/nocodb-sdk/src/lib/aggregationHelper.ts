import UITypes from './UITypes';

enum NumericalAggregations {
  Sum = 'sum',
  Min = 'min',
  Max = 'max',
  Avg = 'avg',
  Median = 'median',
  StandardDeviation = 'std_dev',
  Histogram = 'histogram',
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

const getAvailableAggregations = (type: string): string[] => {
  switch (type) {
    case UITypes.Number:
    case UITypes.Decimal:
    case UITypes.Currency:
    case UITypes.Percent:
    case UITypes.Duration:
    case UITypes.Rating:
    case UITypes.Rollup:
    case UITypes.Links:
      return [
        ...Object.values(NumericalAggregations),
        ...Object.values(CommonAggregations),
      ];
    case UITypes.Attachment:
      return [
        ...Object.values(AttachmentAggregations),
        ...Object.values(CommonAggregations),
      ];
    case UITypes.Checkbox:
      return [...Object.values(BooleanAggregations), CommonAggregations.None];
    case UITypes.Date:
    case UITypes.DateTime:
    case UITypes.LastModifiedTime:
    case UITypes.CreatedTime:
      return [
        ...Object.values(DateAggregations),
        ...Object.values(CommonAggregations),
      ];
  }
  return [...Object.values(CommonAggregations)];
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
