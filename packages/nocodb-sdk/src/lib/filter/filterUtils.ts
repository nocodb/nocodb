import UITypes, { isNumericCol, numericUITypes } from '~/lib/UITypes';
import type { Api, ColumnType, FilterType } from '~/lib/Api';
import { isDateMonthFormat } from '~/lib/dateTimeHelper';
import { parseProp } from '~/lib/helperFunctions';

export interface ComparisonOpUiType {
  text: string;
  // i18n key for the label so the frontend can render it in the active locale,
  // falling back to `text` (e.g. symbol operators like '=', '>' have no key).
  i18nKey?: string;
  value: string;
  ignoreVal: boolean;
  includedTypes?: UITypes[];
  excludedTypes?: UITypes[];
  semanticType?: string; // Semantic category for compatibility checking
  typeSpecificSemantic?: (fieldUiType: UITypes) => string; // Type-specific semantic function
}

// Type-specific label (text + i18n key) for operators whose wording depends on
// the field type. Symbol operators ('=', '>', …) intentionally omit `i18nKey`.
type ComparisonOpLabel = { text: string; i18nKey?: string };

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
    | 'child_delete'
    | 'order';
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

const getEqText = (fieldUiType: UITypes): ComparisonOpLabel => {
  if (isNumericCol(fieldUiType) || fieldUiType === UITypes.Time) {
    return { text: '=' };
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
    return { text: 'is', i18nKey: 'filterOperation.is' };
  }
  return { text: 'is equal', i18nKey: 'filterOperation.isEqual' };
};

const getNeqText = (fieldUiType: UITypes): ComparisonOpLabel => {
  if (isNumericCol(fieldUiType) || fieldUiType === UITypes.Time) {
    return { text: '!=' };
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
    return { text: 'is not', i18nKey: 'filterOperation.isNot' };
  }
  return { text: 'is not equal', i18nKey: 'filterOperation.isNotEqual' };
};

const getLikeText = (fieldUiType: UITypes): ComparisonOpLabel => {
  if (fieldUiType === UITypes.Attachment) {
    return {
      text: 'filenames contain',
      i18nKey: 'filterOperation.filenamesContain',
    };
  }
  return { text: 'is like', i18nKey: 'filterOperation.isLike' };
};

const getNotLikeText = (fieldUiType: UITypes): ComparisonOpLabel => {
  if (fieldUiType === UITypes.Attachment) {
    return {
      text: "filenames don't contain",
      i18nKey: 'filterOperation.filenamesDoNotContain',
    };
  }
  // legacy key name kept (with the space) so existing locale translations resolve
  return { text: 'is not like', i18nKey: 'filterOperation.isNot like' };
};

const getGtText = (fieldUiType: UITypes): ComparisonOpLabel => {
  if (
    [
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
    ].includes(fieldUiType)
  ) {
    return { text: 'is after', i18nKey: 'filterOperation.isAfter' };
  }
  return { text: '>' };
};

const getLtText = (fieldUiType: UITypes): ComparisonOpLabel => {
  if (
    [
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
    ].includes(fieldUiType)
  ) {
    return { text: 'is before', i18nKey: 'filterOperation.isBefore' };
  }
  return { text: '<' };
};

const getGteText = (fieldUiType: UITypes): ComparisonOpLabel => {
  if (
    [
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
    ].includes(fieldUiType)
  ) {
    return { text: 'is on or after', i18nKey: 'filterOperation.isOnOrAfter' };
  }
  return { text: '>=' };
};

const getLteText = (fieldUiType: UITypes): ComparisonOpLabel => {
  if (
    [
      UITypes.Date,
      UITypes.DateTime,
      UITypes.CreatedTime,
      UITypes.LastModifiedTime,
    ].includes(fieldUiType)
  ) {
    return { text: 'is on or before', i18nKey: 'filterOperation.isOnOrBefore' };
  }
  return { text: '<=' };
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
      UITypes.UUID,
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
    i18nKey: 'filterOperation.isChecked',
    value: 'checked',
    ignoreVal: true,
    includedTypes: [UITypes.Checkbox],
    semanticType: 'boolean_equality',
    typeSpecificSemantic: (fieldUiType) =>
      getTypeSpecificSemantic('equality', fieldUiType),
  },
  {
    text: 'is not checked',
    i18nKey: 'filterOperation.isNotChecked',
    value: 'notchecked',
    ignoreVal: true,
    includedTypes: [UITypes.Checkbox],
    semanticType: 'boolean_inequality',
    typeSpecificSemantic: (fieldUiType) =>
      getTypeSpecificSemantic('inequality', fieldUiType),
  },
  {
    ...getEqText(fieldUiType),
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
    ...getNeqText(fieldUiType),
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
    ...getLikeText(fieldUiType),
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
      UITypes.Colour,
      ...numericUITypes,
    ],
    semanticType: 'pattern_match',
    typeSpecificSemantic: (fieldUiType) =>
      getTypeSpecificSemantic('pattern_match', fieldUiType),
  },
  {
    ...getNotLikeText(fieldUiType),
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
      UITypes.Colour,
      ...numericUITypes,
    ],
    semanticType: 'pattern_not_match',
    typeSpecificSemantic: (fieldUiType) =>
      getTypeSpecificSemantic('pattern_not_match', fieldUiType),
  },
  {
    text: 'is empty',
    i18nKey: 'filterOperation.isEmpty',
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
    i18nKey: 'filterOperation.isNotEmpty',
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
    i18nKey: 'filterOperation.isNull',
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
    i18nKey: 'filterOperation.isNotNull',
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
    i18nKey: 'filterOperation.containsAllOf',
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
    i18nKey: 'filterOperation.containsAnyOf',
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
    i18nKey: 'filterOperation.doesNotContainAllOf',
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
    i18nKey: 'filterOperation.doesNotContainAnyOf',
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
    ...getGtText(fieldUiType),
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
    ...getLtText(fieldUiType),
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
    ...getGteText(fieldUiType),
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
    ...getLteText(fieldUiType),
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
    i18nKey: 'filterOperation.isWithin',
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
    i18nKey: 'filterOperation.isBlank',
    value: 'blank',
    ignoreVal: true,
    // UUID excluded: auto-generated on insert, never blank
    excludedTypes: [
      UITypes.Checkbox,
      UITypes.Links,
      UITypes.Rollup,
      UITypes.UUID,
    ],
    semanticType: 'blank_check',
  },
  {
    text: 'is not blank',
    i18nKey: 'filterOperation.isNotBlank',
    value: 'notblank',
    ignoreVal: true,
    // UUID excluded: auto-generated on insert, never blank
    excludedTypes: [
      UITypes.Checkbox,
      UITypes.Links,
      UITypes.Rollup,
      UITypes.UUID,
    ],
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
        i18nKey: 'filterOperation.subOp.pastWeek',
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
        i18nKey: 'filterOperation.subOp.pastMonth',
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
        i18nKey: 'filterOperation.subOp.pastYear',
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
        i18nKey: 'filterOperation.subOp.nextWeek',
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
        i18nKey: 'filterOperation.subOp.nextMonth',
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
        i18nKey: 'filterOperation.subOp.nextYear',
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
        i18nKey: 'filterOperation.subOp.nextNumberOfDays',
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
        i18nKey: 'filterOperation.subOp.pastNumberOfDays',
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
      i18nKey: 'filterOperation.subOp.today',
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
      i18nKey: 'filterOperation.subOp.tomorrow',
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
      i18nKey: 'filterOperation.subOp.yesterday',
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
      i18nKey: 'filterOperation.subOp.oneWeekAgo',
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
      i18nKey: 'filterOperation.subOp.oneWeekFromNow',
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
      i18nKey: 'filterOperation.subOp.oneMonthAgo',
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
      i18nKey: 'filterOperation.subOp.oneMonthFromNow',
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
      i18nKey: 'filterOperation.subOp.daysAgo',
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
      i18nKey: 'filterOperation.subOp.daysFromNow',
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
      i18nKey: isDateMonth
        ? 'filterOperation.subOp.exactMonth'
        : 'filterOperation.subOp.exactDate',
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
            UITypes.Colour,
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
          if (
            eachFilter.value &&
            (isMulti || eachFilter.value.indexOf(',') < 0)
          ) {
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
  workspaceId: string,
  baseId: string,
  filter: FilterType
) => {
  let result: string[] = [];
  if (filter.is_group && filter.children?.length > 0) {
    for (const child of filter.children) {
      result = [
        ...result,
        ...(await deleteFilterWithSub($api, workspaceId, baseId, child)),
      ];
    }
  }
  await $api.internal.postOperation(
    workspaceId,
    baseId,
    {
      operation: 'filterDelete',
      filterId: filter.id as string,
    },
    {}
  );
  result.push(filter.id);
  return result;
};

// Type definitions for compatibility
export type Filter = FilterType;
export type ColumnFilterType = FilterType & {
  tmp_id?: string; // will be used for reordering draft filters
};
