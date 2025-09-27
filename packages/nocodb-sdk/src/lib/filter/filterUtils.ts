import { isNumericCol, numericUITypes, UITypes } from '~/lib';
import type { Api, ColumnType, FilterType } from '~/lib/Api';
import { isDateMonthFormat } from '~/lib';
import { parseProp } from '~/lib';

export interface ComparisonOpUiType {
  text: string;
  value: string;
  ignoreVal: boolean;
  includedTypes?: UITypes[];
  excludedTypes?: UITypes[];
  semanticType?: string; // Semantic category for compatibility checking
  typeSpecificSemantic?: (fieldUiType: UITypes) => string; // Type-specific semantic function
}

export interface FilterGroupChangeEvent {
  filters: ColumnFilterType[];
  filter: ColumnFilterType | null;
  type: 'row_changed' | 'add' | 'delete';
  parentFilter?: ColumnFilterType;
  fk_parent_id?: string;
  prevValue?: any;
  value: any;
  index: number;
}

export interface FilterRowChangeEvent {
  filter: ColumnFilterType;
  type:
    | 'logical_op'
    | 'fk_column_id'
    | 'fk_value_col_id'
    | 'comparison_op'
    | 'comparison_sub_op'
    | 'value'
    | 'dynamic'
    | 'child_add'
    | 'child_delete';
  prevValue: any;
  value: any;
  index: number;
}

export type ColumnTypeForFilter = ColumnType & {
  btLookupColumn?: ColumnTypeForFilter;
  filterUidt?: UITypes;
};

export function isDateType(uidt: UITypes) {
  return [
    UITypes.Date,
    UITypes.DateTime,
    UITypes.CreatedTime,
    UITypes.LastModifiedTime,
  ].includes(uidt);
}

const getEqText = (fieldUiType: UITypes) => {
  if (isNumericCol(fieldUiType) || fieldUiType === UITypes.Time) {
    return '=';
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
    return 'is';
  }
  return 'is equal';
};

const getNeqText = (fieldUiType: UITypes) => {
  if (isNumericCol(fieldUiType) || fieldUiType === UITypes.Time) {
    return '!=';
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
    return 'is not';
  }
  return 'is not equal';
};

const getLikeText = (fieldUiType: UITypes) => {
  if (fieldUiType === UITypes.Attachment) {
    return 'filenames contain';
  }
  return 'is like';
};

const getNotLikeText = (fieldUiType: UITypes) => {
  if (fieldUiType === UITypes.Attachment) {
    return "filenames don't contain";
  }
  return 'is not like';
};

const getGtText = (fieldUiType: UITypes) => {
  if (
    [
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
    ].includes(fieldUiType)
  ) {
    return 'is after';
  }
  return '>';
};

const getLtText = (fieldUiType: UITypes) => {
  if (
    [
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
    ].includes(fieldUiType)
  ) {
    return 'is before';
  }
  return '<';
};

const getGteText = (fieldUiType: UITypes) => {
  if (
    [
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
    ].includes(fieldUiType)
  ) {
    return 'is on or after';
  }
  return '>=';
};

const getLteText = (fieldUiType: UITypes) => {
  if (
    [
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
    ].includes(fieldUiType)
  ) {
    return 'is on or before';
  }
  return '<=';
};

// Helper functions for type-specific semantic types
const getTypeSpecificSemantic = (
  baseSemantic: string,
  fieldUiType: UITypes
): string => {
  if (isNumericCol(fieldUiType)) {
    return `${baseSemantic}_numeric`;
  } else if (isDateType(fieldUiType)) {
    return `${baseSemantic}_date`;
  } else if (
    [
      UITypes.SingleLineText,
      UITypes.LongText,
      UITypes.Email,
      UITypes.PhoneNumber,
      UITypes.URL,
    ].includes(fieldUiType)
  ) {
    return `${baseSemantic}_text`;
  } else if (
    [UITypes.SingleSelect, UITypes.MultiSelect].includes(fieldUiType)
  ) {
    return `${baseSemantic}_select`;
  } else if ([UITypes.Checkbox].includes(fieldUiType)) {
    return `${baseSemantic}_boolean`;
  } else if (
    [UITypes.User, UITypes.CreatedBy, UITypes.LastModifiedBy].includes(
      fieldUiType
    )
  ) {
    return `${baseSemantic}_user`;
  } else if ([UITypes.Attachment].includes(fieldUiType)) {
    return `${baseSemantic}_attachment`;
  } else if (
    [UITypes.LinkToAnotherRecord, UITypes.Lookup].includes(fieldUiType)
  ) {
    return `${baseSemantic}_link`;
  }
  return baseSemantic; // fallback to base semantic
};

export const comparisonOpList = (
  fieldUiType: UITypes,

  _dateFormat?: string
): ComparisonOpUiType[] => [
  {
    text: 'is checked',
    value: 'checked',
    ignoreVal: true,
    includedTypes: [UITypes.Checkbox],
    semanticType: 'boolean_equality',
    typeSpecificSemantic: (fieldUiType) =>
      getTypeSpecificSemantic('equality', fieldUiType),
  },
  {
    text: 'is not checked',
    value: 'notchecked',
    ignoreVal: true,
    includedTypes: [UITypes.Checkbox],
    semanticType: 'boolean_inequality',
    typeSpecificSemantic: (fieldUiType) =>
      getTypeSpecificSemantic('inequality', fieldUiType),
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
    semanticType: 'equality',
    typeSpecificSemantic: (fieldUiType) =>
      getTypeSpecificSemantic('equality', fieldUiType),
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
    semanticType: 'inequality',
    typeSpecificSemantic: (fieldUiType) =>
      getTypeSpecificSemantic('inequality', fieldUiType),
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
    semanticType: 'pattern_match',
    typeSpecificSemantic: (fieldUiType) =>
      getTypeSpecificSemantic('pattern_match', fieldUiType),
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
    semanticType: 'pattern_not_match',
    typeSpecificSemantic: (fieldUiType) =>
      getTypeSpecificSemantic('pattern_not_match', fieldUiType),
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
    semanticType: 'empty_check',
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
    semanticType: 'not_empty_check',
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
    semanticType: 'null_check',
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
    semanticType: 'not_null_check',
  },
  {
    text: 'contains all of',
    value: 'allof',
    ignoreVal: false,
    includedTypes: [
      UITypes.MultiSelect,
      UITypes.User,
      UITypes.CreatedBy,
      UITypes.LastModifiedBy,
    ],
    semanticType: 'contains_all',
  },
  {
    text: 'contains any of',
    value: 'anyof',
    ignoreVal: false,
    includedTypes: [
      UITypes.MultiSelect,
      UITypes.SingleSelect,
      UITypes.User,
      UITypes.CreatedBy,
      UITypes.LastModifiedBy,
    ],
    semanticType: 'contains_any',
  },
  {
    text: 'does not contain all of',
    value: 'nallof',
    ignoreVal: false,
    includedTypes: [
      UITypes.MultiSelect,
      UITypes.User,
      UITypes.CreatedBy,
      UITypes.LastModifiedBy,
    ],
    semanticType: 'not_contains_all',
  },
  {
    text: 'does not contain any of',
    value: 'nanyof',
    ignoreVal: false,
    includedTypes: [
      UITypes.MultiSelect,
      UITypes.SingleSelect,
      UITypes.User,
      UITypes.CreatedBy,
      UITypes.LastModifiedBy,
    ],
    semanticType: 'not_contains_any',
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
    semanticType: 'greater_than',
    typeSpecificSemantic: (fieldUiType) =>
      getTypeSpecificSemantic('greater_than', fieldUiType),
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
    semanticType: 'less_than',
    typeSpecificSemantic: (fieldUiType) =>
      getTypeSpecificSemantic('less_than', fieldUiType),
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
    semanticType: 'greater_than_or_equal',
    typeSpecificSemantic: (fieldUiType) =>
      getTypeSpecificSemantic('greater_than_or_equal', fieldUiType),
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
    semanticType: 'less_than_or_equal',
    typeSpecificSemantic: (fieldUiType) =>
      getTypeSpecificSemantic('less_than_or_equal', fieldUiType),
  },
  {
    text: 'is within',
    value: 'isWithin',
    ignoreVal: true,
    includedTypes: [
      UITypes.Date,
      UITypes.DateTime,
      UITypes.LastModifiedTime,
      UITypes.CreatedTime,
    ],
    semanticType: 'date_range',
  },
  {
    text: 'is blank',
    value: 'blank',
    ignoreVal: true,
    excludedTypes: [UITypes.Checkbox, UITypes.Links, UITypes.Rollup],
    semanticType: 'blank_check',
  },
  {
    text: 'is not blank',
    value: 'notblank',
    ignoreVal: true,
    excludedTypes: [UITypes.Checkbox, UITypes.Links, UITypes.Rollup],
    semanticType: 'not_blank_check',
  },
];

export const comparisonSubOpList = (
  // TODO: type
  comparison_op: string,
  dateFormat?: string
): ComparisonOpUiType[] => {
  const isDateMonth = dateFormat && isDateMonthFormat(dateFormat);

  if (comparison_op === 'isWithin') {
    return [
      {
        text: 'the past week',
        value: 'pastWeek',
        ignoreVal: true,
        includedTypes: [
          UITypes.Date,
          UITypes.DateTime,
          UITypes.LastModifiedTime,
          UITypes.CreatedTime,
        ],
      },
      {
        text: 'the past month',
        value: 'pastMonth',
        ignoreVal: true,
        includedTypes: [
          UITypes.Date,
          UITypes.DateTime,
          UITypes.LastModifiedTime,
          UITypes.CreatedTime,
        ],
      },
      {
        text: 'the past year',
        value: 'pastYear',
        ignoreVal: true,
        includedTypes: [
          UITypes.Date,
          UITypes.DateTime,
          UITypes.LastModifiedTime,
          UITypes.CreatedTime,
        ],
      },
      {
        text: 'the next week',
        value: 'nextWeek',
        ignoreVal: true,
        includedTypes: [
          UITypes.Date,
          UITypes.DateTime,
          UITypes.LastModifiedTime,
          UITypes.CreatedTime,
        ],
      },
      {
        text: 'the next month',
        value: 'nextMonth',
        ignoreVal: true,
        includedTypes: [
          UITypes.Date,
          UITypes.DateTime,
          UITypes.LastModifiedTime,
          UITypes.CreatedTime,
        ],
      },
      {
        text: 'the next year',
        value: 'nextYear',
        ignoreVal: true,
        includedTypes: [
          UITypes.Date,
          UITypes.DateTime,
          UITypes.LastModifiedTime,
          UITypes.CreatedTime,
        ],
      },
      {
        text: 'the next number of days',
        value: 'nextNumberOfDays',
        ignoreVal: false,
        includedTypes: [
          UITypes.Date,
          UITypes.DateTime,
          UITypes.LastModifiedTime,
          UITypes.CreatedTime,
        ],
      },
      {
        text: 'the past number of days',
        value: 'pastNumberOfDays',
        ignoreVal: false,
        includedTypes: [
          UITypes.Date,
          UITypes.DateTime,
          UITypes.LastModifiedTime,
          UITypes.CreatedTime,
        ],
      },
    ];
  }
  return [
    {
      text: 'today',
      value: 'today',
      ignoreVal: true,
      includedTypes: [
        ...(isDateMonth
          ? []
          : [
              UITypes.Date,
              UITypes.DateTime,
              UITypes.LastModifiedTime,
              UITypes.CreatedTime,
            ]),
      ],
    },
    {
      text: 'tomorrow',
      value: 'tomorrow',
      ignoreVal: true,
      includedTypes: [
        ...(isDateMonth
          ? []
          : [
              UITypes.Date,
              UITypes.DateTime,
              UITypes.LastModifiedTime,
              UITypes.CreatedTime,
            ]),
      ],
    },
    {
      text: 'yesterday',
      value: 'yesterday',
      ignoreVal: true,
      includedTypes: [
        ...(isDateMonth
          ? []
          : [
              UITypes.Date,
              UITypes.DateTime,
              UITypes.LastModifiedTime,
              UITypes.CreatedTime,
            ]),
      ],
    },
    {
      text: 'one week ago',
      value: 'oneWeekAgo',
      ignoreVal: true,
      includedTypes: [
        ...(isDateMonth
          ? []
          : [
              UITypes.Date,
              UITypes.DateTime,
              UITypes.LastModifiedTime,
              UITypes.CreatedTime,
            ]),
      ],
    },
    {
      text: 'one week from now',
      value: 'oneWeekFromNow',
      ignoreVal: true,
      includedTypes: [
        ...(isDateMonth
          ? []
          : [
              UITypes.Date,
              UITypes.DateTime,
              UITypes.LastModifiedTime,
              UITypes.CreatedTime,
            ]),
      ],
    },
    {
      text: 'one month ago',
      value: 'oneMonthAgo',
      ignoreVal: true,
      includedTypes: [
        UITypes.Date,
        UITypes.DateTime,
        UITypes.LastModifiedTime,
        UITypes.CreatedTime,
      ],
    },
    {
      text: 'one month from now',
      value: 'oneMonthFromNow',
      ignoreVal: true,
      includedTypes: [
        UITypes.Date,
        UITypes.DateTime,
        UITypes.LastModifiedTime,
        UITypes.CreatedTime,
      ],
    },
    {
      text: 'number of days ago',
      value: 'daysAgo',
      ignoreVal: false,
      includedTypes: [
        ...(isDateMonth
          ? []
          : [
              UITypes.Date,
              UITypes.DateTime,
              UITypes.LastModifiedTime,
              UITypes.CreatedTime,
            ]),
      ],
    },
    {
      text: 'number of days from now',
      value: 'daysFromNow',
      ignoreVal: false,
      includedTypes: [
        ...(isDateMonth
          ? []
          : [
              UITypes.Date,
              UITypes.DateTime,
              UITypes.LastModifiedTime,
              UITypes.CreatedTime,
            ]),
      ],
    },
    {
      text: isDateMonth ? 'exact month' : 'exact date',
      value: 'exactDate',
      ignoreVal: false,
      includedTypes: [
        UITypes.Date,
        UITypes.DateTime,
        UITypes.LastModifiedTime,
        UITypes.CreatedTime,
      ],
    },
  ];
};

export const getPlaceholderNewRow = (
  filters: Filter[],
  columns: ColumnType[],
  option?: {
    currentUser?: {
      email: string;
      id: string;
    };
  }
) => {
  if (filters.some((filter) => filter.logical_op === 'or')) {
    return {};
  }
  const placeholderNewRow: Record<string, any> = {};
  for (const eachFilter of filters) {
    if (
      ['checked', 'notchecked', 'allof', 'eq'].includes(
        eachFilter.comparison_op as any
      )
    ) {
      const column = columns.find((col) => col.id === eachFilter.fk_column_id);
      if (column) {
        if (
          [
            UITypes.Number,
            UITypes.Decimal,
            UITypes.SingleLineText,
            UITypes.LongText,
            UITypes.SingleSelect,
            UITypes.GeoData,
            UITypes.Email,
            UITypes.PhoneNumber,
            UITypes.URL,
            UITypes.Time,
            UITypes.Year,
            UITypes.Currency,
            UITypes.Percent,
            UITypes.Rating,
            UITypes.Duration,
            UITypes.JSON,

            // User is using allOf and anyOf so we cannot include it here
            // UITypes.User,
          ].includes(column.uidt as UITypes) ||
          ([UITypes.Date, UITypes.DateTime].includes(column.uidt as UITypes) &&
            eachFilter.comparison_sub_op === 'exactDate')
        ) {
          placeholderNewRow[column.title!] = eachFilter.value;
        } else if (
          [UITypes.Checkbox].includes(column.uidt as UITypes) &&
          ['checked', 'notchecked'].includes(eachFilter.comparison_op as any)
        ) {
          placeholderNewRow[column.title!] =
            eachFilter.comparison_op === 'checked';
        } else if (
          [UITypes.MultiSelect].includes(column.uidt as UITypes) &&
          ['allof'].includes(eachFilter.comparison_op)
        ) {
          placeholderNewRow[column.title!] = eachFilter.value;
        } else if (
          [UITypes.User].includes(column.uidt as UITypes) &&
          ['allof'].includes(eachFilter.comparison_op)
        ) {
          const isMulti = parseProp(column.meta)?.is_multi;
          if (isMulti || eachFilter.value?.indexOf?.(',') < 0) {
            const assignedValue = eachFilter.value
              .split(',')
              .map((k) => (k === '@me' ? option?.currentUser?.id : k))
              .filter((k) => k)
              .join(',');
            placeholderNewRow[column.title!] = assignedValue;
          }
        }
      }
    }
  }
  return placeholderNewRow;
};

export const isComparisonOpAllowed = (
  filter: ColumnFilterType,
  compOp: {
    text: string;
    value: string;
    ignoreVal?: boolean;
    includedTypes?: UITypes[];
    excludedTypes?: UITypes[];
  },
  uidt?: UITypes,
  showNullAndEmptyInFilter?: boolean
) => {
  const isNullOrEmptyOp = ['empty', 'notempty', 'null', 'notnull'].includes(
    compOp.value
  );

  if (compOp.includedTypes) {
    // include allowed values only if selected column type matches
    if (filter.fk_column_id && compOp.includedTypes.includes(uidt!)) {
      // for 'empty', 'notempty', 'null', 'notnull',
      // show them based on `showNullAndEmptyInFilter` in Base Settings
      return isNullOrEmptyOp ? showNullAndEmptyInFilter : true;
    } else {
      return false;
    }
  } else if (compOp.excludedTypes) {
    // include not allowed values only if selected column type not matches
    if (filter.fk_column_id && !compOp.excludedTypes.includes(uidt!)) {
      // for 'empty', 'notempty', 'null', 'notnull',
      // show them based on `showNullAndEmptyInFilter` in Base Settings
      return isNullOrEmptyOp ? showNullAndEmptyInFilter : true;
    } else {
      return false;
    }
  }
  // explicitly include for non-null / non-empty ops
  return isNullOrEmptyOp ? showNullAndEmptyInFilter : true;
};

export const getFilterCount = (filters: FilterType[]) => {
  let result = 0;
  for (const filter of filters) {
    if (filter.is_group) {
      result += getFilterCount(filter.children ?? []);
    } else {
      result += 1;
    }
  }
  return result;
};
export const deleteFilterWithSub = async (
  $api: Api<unknown>,
  filter: FilterType
) => {
  let result: string[] = [];
  if (filter.is_group && filter.children?.length > 0) {
    for (const child of filter.children) {
      result = [...result, ...(await deleteFilterWithSub($api, child))];
    }
  }
  await $api.dbTableFilter.delete(filter.id);
  result.push(filter.id);
  return result;
};

// Type definitions for compatibility
export type Filter = FilterType;
export type ColumnFilterType = FilterType;
