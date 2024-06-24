import UITypes from './UITypes';

enum NumericalAggregations {
  Sum = 'sum',
  Count = 'count',
  Min = 'min',
  Max = 'max',
  Avg = 'avg',
  Median = 'median',
  StandardDeviation = 'stdDev',
  Histogram = 'histogram',
  Range = 'range',
}

enum CommonAggregations {
  PercentEmpty = 'percentEmpty',
  PercentFilled = 'percentFilled',
  PercentUnique = 'percentUnique',
  CountUnique = 'countUnique',
  CountEmpty = 'countEmpty',
  CountFilled = 'countFilled',
  None = 'none',
}

const getAvailableAggregations = (type: UITypes) => {
  switch (type) {
    case UITypes.Number:
    case UITypes.Decimal:
    case UITypes.Currency:
    case UITypes.Percent:
    case UITypes.Duration:
    case UITypes.Rating:
    case UITypes.Rollup:
      return [
        ...Object.values(NumericalAggregations),
        ...Object.values(CommonAggregations),
      ];
  }
  return Object.values(CommonAggregations);
};

export { getAvailableAggregations, NumericalAggregations, CommonAggregations };
