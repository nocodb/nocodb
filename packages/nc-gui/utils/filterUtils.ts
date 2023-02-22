import { UITypes, isNumericCol, numericUITypes } from 'nocodb-sdk'

const getEqText = (fieldUiType: UITypes) => {
  if (isNumericCol(fieldUiType)) {
    return '='
  } else if (
    [UITypes.SingleSelect, UITypes.Collaborator, UITypes.LinkToAnotherRecord, UITypes.Date, UITypes.DateTime].includes(
      fieldUiType,
    )
  ) {
    return 'is'
  }
  return 'is equal'
}

const getNeqText = (fieldUiType: UITypes) => {
  if (isNumericCol(fieldUiType)) {
    return '!='
  } else if (
    [UITypes.SingleSelect, UITypes.Collaborator, UITypes.LinkToAnotherRecord, UITypes.Date, UITypes.DateTime].includes(
      fieldUiType,
    )
  ) {
    return 'is not'
  }
  return 'is not equal'
}

const getLikeText = (fieldUiType: UITypes) => {
  if (fieldUiType === UITypes.Attachment) {
    return 'filenames contain'
  }
  return 'is like'
}

const getNotLikeText = (fieldUiType: UITypes) => {
  if (fieldUiType === UITypes.Attachment) {
    return "filenames doesn't contain"
  }
  return 'is not like'
}

const getGtText = (fieldUiType: UITypes) => {
  if ([UITypes.Date, UITypes.DateTime].includes(fieldUiType)) {
    return 'is after'
  }
  return '>'
}

const getLtText = (fieldUiType: UITypes) => {
  if ([UITypes.Date, UITypes.DateTime].includes(fieldUiType)) {
    return 'is before'
  }
  return '<'
}

const getGteText = (fieldUiType: UITypes) => {
  if ([UITypes.Date, UITypes.DateTime].includes(fieldUiType)) {
    return 'is on or after'
  }
  return '>='
}

const getLteText = (fieldUiType: UITypes) => {
  if ([UITypes.Date, UITypes.DateTime].includes(fieldUiType)) {
    return 'is on or before'
  }
  return '<='
}

export const comparisonOpList = (
  fieldUiType: UITypes,
): {
  text: string
  value: string
  ignoreVal?: boolean
  includedTypes?: UITypes[]
  excludedTypes?: UITypes[]
}[] => [
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
    text: getEqText(fieldUiType),
    value: 'eq',
    excludedTypes: [UITypes.Checkbox, UITypes.MultiSelect, UITypes.Attachment],
  },
  {
    text: getNeqText(fieldUiType),
    value: 'neq',
    excludedTypes: [UITypes.Checkbox, UITypes.MultiSelect, UITypes.Attachment],
  },
  {
    text: getLikeText(fieldUiType),
    value: 'like',
    excludedTypes: [UITypes.Checkbox, UITypes.SingleSelect, UITypes.MultiSelect, UITypes.Collaborator, ...numericUITypes],
  },
  {
    text: getNotLikeText(fieldUiType),
    value: 'nlike',
    excludedTypes: [UITypes.Checkbox, UITypes.SingleSelect, UITypes.MultiSelect, UITypes.Collaborator, ...numericUITypes],
  },
  {
    text: 'is empty',
    value: 'empty',
    ignoreVal: true,
    excludedTypes: [
      UITypes.Checkbox,
      UITypes.SingleSelect,
      UITypes.MultiSelect,
      UITypes.Collaborator,
      UITypes.Attachment,
      UITypes.LinkToAnotherRecord,
      UITypes.Lookup,
      ...numericUITypes,
    ],
  },
  {
    text: 'is not empty',
    value: 'notempty',
    ignoreVal: true,
    excludedTypes: [
      UITypes.Checkbox,
      UITypes.SingleSelect,
      UITypes.MultiSelect,
      UITypes.Collaborator,
      UITypes.Attachment,
      UITypes.LinkToAnotherRecord,
      UITypes.Lookup,
      ...numericUITypes,
    ],
  },
  {
    text: 'is null',
    value: 'null',
    ignoreVal: true,
    excludedTypes: [
      ...numericUITypes,
      UITypes.Checkbox,
      UITypes.SingleSelect,
      UITypes.MultiSelect,
      UITypes.Collaborator,
      UITypes.Attachment,
      UITypes.LinkToAnotherRecord,
      UITypes.Lookup,
    ],
  },
  {
    text: 'is not null',
    value: 'notnull',
    ignoreVal: true,
    excludedTypes: [
      ...numericUITypes,
      UITypes.Checkbox,
      UITypes.SingleSelect,
      UITypes.MultiSelect,
      UITypes.Collaborator,
      UITypes.Attachment,
      UITypes.LinkToAnotherRecord,
      UITypes.Lookup,
    ],
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
    text: getGtText(fieldUiType),
    value: 'gt',
    includedTypes: [...numericUITypes, UITypes.Date, UITypes.DateTime],
  },
  {
    text: getLtText(fieldUiType),
    value: 'lt',
    includedTypes: [...numericUITypes, UITypes.Date, UITypes.DateTime],
  },
  {
    text: getGteText(fieldUiType),
    value: 'gte',
    includedTypes: [...numericUITypes, UITypes.Date, UITypes.DateTime],
  },
  {
    text: getLteText(fieldUiType),
    value: 'lte',
    includedTypes: [...numericUITypes, UITypes.Date, UITypes.DateTime],
  },
  {
    text: 'is blank',
    value: 'blank',
    ignoreVal: true,
    excludedTypes: [UITypes.Checkbox],
  },
  {
    text: 'is not blank',
    value: 'notblank',
    ignoreVal: true,
    excludedTypes: [UITypes.Checkbox],
  },
]
