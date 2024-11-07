import { UITypes, isDateMonthFormat, isNumericCol, numericUITypes } from 'nocodb-sdk'

const getEqText = (fieldUiType: UITypes) => {
  if (isNumericCol(fieldUiType) || fieldUiType === UITypes.Time) {
    return '='
  } else if (
    [
      UITypes.SingleSelect,
      UITypes.Collaborator,
      UITypes.LinkToAnotherRecord,
      UITypes.Date,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
      UITypes.DateTime,
    ].includes(fieldUiType)
  ) {
    return 'is'
  }
  return 'is equal'
}

const getNeqText = (fieldUiType: UITypes) => {
  if (isNumericCol(fieldUiType) || fieldUiType === UITypes.Time) {
    return '!='
  } else if (
    [
      UITypes.SingleSelect,
      UITypes.Collaborator,
      UITypes.LinkToAnotherRecord,
      UITypes.Date,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
      UITypes.DateTime,
    ].includes(fieldUiType)
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
    return "filenames don't contain"
  }
  return 'is not like'
}

const getGtText = (fieldUiType: UITypes) => {
  if ([UITypes.Date, UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime].includes(fieldUiType)) {
    return 'is after'
  }
  return '>'
}

const getLtText = (fieldUiType: UITypes) => {
  if ([UITypes.Date, UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime].includes(fieldUiType)) {
    return 'is before'
  }
  return '<'
}

const getGteText = (fieldUiType: UITypes) => {
  if ([UITypes.Date, UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime].includes(fieldUiType)) {
    return 'is on or after'
  }
  return '>='
}

const getLteText = (fieldUiType: UITypes) => {
  if ([UITypes.Date, UITypes.DateTime, UITypes.CreatedTime, UITypes.LastModifiedTime].includes(fieldUiType)) {
    return 'is on or before'
  }
  return '<='
}

export const comparisonOpList = (
  fieldUiType: UITypes,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  dateFormat?: string,
): {
  text: string
  value: string
  ignoreVal: boolean
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
    ignoreVal: false,
    excludedTypes: [
      UITypes.Checkbox,
      UITypes.MultiSelect,
      UITypes.Attachment,
      UITypes.User,
      UITypes.CreatedBy,
      UITypes.LastModifiedBy,
    ],
  },
  {
    text: getNeqText(fieldUiType),
    value: 'neq',
    ignoreVal: false,
    excludedTypes: [
      UITypes.Checkbox,
      UITypes.MultiSelect,
      UITypes.Attachment,
      UITypes.User,
      UITypes.CreatedBy,
      UITypes.LastModifiedBy,
    ],
  },
  {
    text: getLikeText(fieldUiType),
    value: 'like',
    ignoreVal: false,
    excludedTypes: [
      UITypes.Checkbox,
      UITypes.SingleSelect,
      UITypes.MultiSelect,
      UITypes.User,
      UITypes.CreatedBy,
      UITypes.LastModifiedBy,
      UITypes.Collaborator,
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
      UITypes.Time,
      ...numericUITypes,
    ],
  },
  {
    text: getNotLikeText(fieldUiType),
    value: 'nlike',
    ignoreVal: false,
    excludedTypes: [
      UITypes.Checkbox,
      UITypes.SingleSelect,
      UITypes.MultiSelect,
      UITypes.User,
      UITypes.CreatedBy,
      UITypes.LastModifiedBy,
      UITypes.Collaborator,
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
      UITypes.Time,
      ...numericUITypes,
    ],
  },
  {
    text: 'is empty',
    value: 'empty',
    ignoreVal: true,
    excludedTypes: [
      UITypes.Checkbox,
      UITypes.SingleSelect,
      UITypes.MultiSelect,
      UITypes.User,
      UITypes.CreatedBy,
      UITypes.LastModifiedBy,
      UITypes.Collaborator,
      UITypes.Attachment,
      UITypes.LinkToAnotherRecord,
      UITypes.Lookup,
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
      UITypes.Time,
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
      UITypes.User,
      UITypes.CreatedBy,
      UITypes.LastModifiedBy,
      UITypes.Collaborator,
      UITypes.Attachment,
      UITypes.LinkToAnotherRecord,
      UITypes.Lookup,
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
      UITypes.Time,
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
      UITypes.User,
      UITypes.CreatedBy,
      UITypes.LastModifiedBy,
      UITypes.Collaborator,
      UITypes.Attachment,
      UITypes.LinkToAnotherRecord,
      UITypes.Lookup,
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
      UITypes.Time,
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
      UITypes.User,
      UITypes.CreatedBy,
      UITypes.LastModifiedBy,
      UITypes.Collaborator,
      UITypes.Attachment,
      UITypes.LinkToAnotherRecord,
      UITypes.Lookup,
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
      UITypes.Time,
    ],
  },
  {
    text: 'contains all of',
    value: 'allof',
    ignoreVal: false,
    includedTypes: [UITypes.MultiSelect, UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy],
  },
  {
    text: 'contains any of',
    value: 'anyof',
    ignoreVal: false,
    includedTypes: [UITypes.MultiSelect, UITypes.SingleSelect, UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy],
  },
  {
    text: 'does not contain all of',
    value: 'nallof',
    ignoreVal: false,
    includedTypes: [UITypes.MultiSelect, UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy],
  },
  {
    text: 'does not contain any of',
    value: 'nanyof',
    ignoreVal: false,
    includedTypes: [UITypes.MultiSelect, UITypes.SingleSelect, UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy],
  },
  {
    text: getGtText(fieldUiType),
    value: 'gt',
    ignoreVal: false,
    includedTypes: [
      ...numericUITypes,
      UITypes.Date,
      UITypes.DateTime,
      UITypes.LastModifiedTime,
      UITypes.CreatedTime,
      UITypes.Time,
    ],
  },
  {
    text: getLtText(fieldUiType),
    value: 'lt',
    ignoreVal: false,
    includedTypes: [
      ...numericUITypes,
      UITypes.Date,
      UITypes.DateTime,
      UITypes.LastModifiedTime,
      UITypes.CreatedTime,
      UITypes.Time,
    ],
  },
  {
    text: getGteText(fieldUiType),
    value: 'gte',
    ignoreVal: false,
    includedTypes: [
      ...numericUITypes,
      UITypes.Date,
      UITypes.DateTime,
      UITypes.LastModifiedTime,
      UITypes.CreatedTime,
      UITypes.Time,
    ],
  },
  {
    text: getLteText(fieldUiType),
    value: 'lte',
    ignoreVal: false,
    includedTypes: [
      ...numericUITypes,
      UITypes.Date,
      UITypes.DateTime,
      UITypes.Time,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
    ],
  },
  {
    text: 'is within',
    value: 'isWithin',
    ignoreVal: true,
    includedTypes: [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime],
  },
  {
    text: 'is blank',
    value: 'blank',
    ignoreVal: true,
    excludedTypes: [UITypes.Checkbox, UITypes.Links, UITypes.Rollup],
  },
  {
    text: 'is not blank',
    value: 'notblank',
    ignoreVal: true,
    excludedTypes: [UITypes.Checkbox, UITypes.Links, UITypes.Rollup],
  },
]

export const comparisonSubOpList = (
  // TODO: type
  comparison_op: string,
  dateFormat?: string,
): {
  text: string
  value: string
  ignoreVal: boolean
  includedTypes?: UITypes[]
  excludedTypes?: UITypes[]
}[] => {
  const isDateMonth = dateFormat && isDateMonthFormat(dateFormat)

  if (comparison_op === 'isWithin') {
    return [
      {
        text: 'the past week',
        value: 'pastWeek',
        ignoreVal: true,
        includedTypes: [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime],
      },
      {
        text: 'the past month',
        value: 'pastMonth',
        ignoreVal: true,
        includedTypes: [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime],
      },
      {
        text: 'the past year',
        value: 'pastYear',
        ignoreVal: true,
        includedTypes: [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime],
      },
      {
        text: 'the next week',
        value: 'nextWeek',
        ignoreVal: true,
        includedTypes: [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime],
      },
      {
        text: 'the next month',
        value: 'nextMonth',
        ignoreVal: true,
        includedTypes: [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime],
      },
      {
        text: 'the next year',
        value: 'nextYear',
        ignoreVal: true,
        includedTypes: [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime],
      },
      {
        text: 'the next number of days',
        value: 'nextNumberOfDays',
        ignoreVal: false,
        includedTypes: [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime],
      },
      {
        text: 'the past number of days',
        value: 'pastNumberOfDays',
        ignoreVal: false,
        includedTypes: [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime],
      },
    ]
  }
  return [
    {
      text: 'today',
      value: 'today',
      ignoreVal: true,
      includedTypes: [...(isDateMonth ? [] : [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime])],
    },
    {
      text: 'tomorrow',
      value: 'tomorrow',
      ignoreVal: true,
      includedTypes: [...(isDateMonth ? [] : [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime])],
    },
    {
      text: 'yesterday',
      value: 'yesterday',
      ignoreVal: true,
      includedTypes: [...(isDateMonth ? [] : [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime])],
    },
    {
      text: 'one week ago',
      value: 'oneWeekAgo',
      ignoreVal: true,
      includedTypes: [...(isDateMonth ? [] : [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime])],
    },
    {
      text: 'one week from now',
      value: 'oneWeekFromNow',
      ignoreVal: true,
      includedTypes: [...(isDateMonth ? [] : [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime])],
    },
    {
      text: 'one month ago',
      value: 'oneMonthAgo',
      ignoreVal: true,
      includedTypes: [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime],
    },
    {
      text: 'one month from now',
      value: 'oneMonthFromNow',
      ignoreVal: true,
      includedTypes: [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime],
    },
    {
      text: 'number of days ago',
      value: 'daysAgo',
      ignoreVal: false,
      includedTypes: [...(isDateMonth ? [] : [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime])],
    },
    {
      text: 'number of days from now',
      value: 'daysFromNow',
      ignoreVal: false,
      includedTypes: [...(isDateMonth ? [] : [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime])],
    },
    {
      text: isDateMonth ? 'exact month' : 'exact date',
      value: 'exactDate',
      ignoreVal: false,
      includedTypes: [UITypes.Date, UITypes.DateTime, UITypes.LastModifiedTime, UITypes.CreatedTime],
    },
  ]
}
