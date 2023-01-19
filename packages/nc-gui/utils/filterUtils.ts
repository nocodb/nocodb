export const comparisonOpList = [
  {
    text: 'is equal',
    value: 'eq',
  },
  {
    text: 'is not equal',
    value: 'neq',
  },
  {
    text: 'is like',
    value: 'like',
  },
  {
    text: 'is not like',
    value: 'nlike',
  },
  {
    text: 'is empty',
    value: 'empty',
    ignoreVal: true,
  },
  {
    text: 'is not empty',
    value: 'notempty',
    ignoreVal: true,
  },
  {
    text: 'is null',
    value: 'null',
    ignoreVal: true,
  },
  {
    text: 'is not null',
    value: 'notnull',
    ignoreVal: true,
  },
  {
    text: 'contains all of',
    value: 'allof',
    types: ['MultiSelect'],
  },
  {
    text: 'contains any of',
    value: 'anyof',
    types: ['MultiSelect'],
  },
  {
    text: 'does not contain all of',
    value: 'nallof',
    types: ['MultiSelect'],
  },
  {
    text: 'does not contain any of',
    value: 'nanyof',
    types: ['MultiSelect'],
  },
  {
    text: '>',
    value: 'gt',
  },
  {
    text: '<',
    value: 'lt',
  },
  {
    text: '>=',
    value: 'gte',
  },
  {
    text: '<=',
    value: 'lte',
  },
]
