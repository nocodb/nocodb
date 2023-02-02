import { UITypes } from 'nocodb-sdk'

const numericUITypes = [UITypes.Duration, UITypes.Currency, UITypes.Percent, UITypes.Number, UITypes.Rating, UITypes.Rollup]

export const comparisonOpList: {
  text: string
  value: string
  ignoreVal?: boolean
  includedTypes?: UITypes[]
  excludedTypes?: UITypes[]
}[] = [
  {
    text: 'is checked',
    value: 'checked',
    ignoreVal: true,
    includedTypes: [UITypes.Checkbox],
  },
  {
    text: 'is not checked',
    value: 'notchecked',
    ignoreVal: true,
    includedTypes: [UITypes.Checkbox],
  },
  {
    text: 'is equal',
    value: 'eq',
    excludedTypes: [UITypes.Checkbox, UITypes.MultiSelect],
  },
  {
    text: 'is not equal',
    value: 'neq',
    excludedTypes: [UITypes.Checkbox, UITypes.MultiSelect],
  },
  {
    text: 'is like',
    value: 'like',
    excludedTypes: [UITypes.Checkbox, UITypes.SingleSelect, UITypes.MultiSelect, UITypes.Collaborator, ...numericUITypes],
  },
  {
    text: 'is not like',
    value: 'nlike',
    excludedTypes: [UITypes.Checkbox, UITypes.SingleSelect, UITypes.MultiSelect, UITypes.Collaborator, ...numericUITypes],
  },
  {
    text: 'is empty',
    value: 'empty',
    ignoreVal: true,
    excludedTypes: [UITypes.Checkbox, UITypes.SingleSelect, UITypes.MultiSelect, UITypes.Collaborator, ...numericUITypes],
  },
  {
    text: 'is not empty',
    value: 'notempty',
    ignoreVal: true,
    excludedTypes: [UITypes.Checkbox, UITypes.SingleSelect, UITypes.MultiSelect, UITypes.Collaborator, ...numericUITypes],
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
    includedTypes: [UITypes.MultiSelect],
  },
  {
    text: 'contains any of',
    value: 'anyof',
    includedTypes: [UITypes.MultiSelect, UITypes.SingleSelect],
  },
  {
    text: 'does not contain all of',
    value: 'nallof',
    includedTypes: [UITypes.MultiSelect],
  },
  {
    text: 'does not contain any of',
    value: 'nanyof',
    includedTypes: [UITypes.MultiSelect, UITypes.SingleSelect],
  },
  {
    text: '>',
    value: 'gt',
    includedTypes: [...numericUITypes],
  },
  {
    text: '<',
    value: 'lt',
    includedTypes: [...numericUITypes],
  },
  {
    text: '>=',
    value: 'gte',
    includedTypes: [...numericUITypes],
  },
  {
    text: '<=',
    value: 'lte',
    includedTypes: [...numericUITypes],
  },
]
