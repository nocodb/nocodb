// Operator vocabulary of the `where` DSL. No dependencies, so the script
// runtime bundle can use it without the lexer or dayjs.

export const GROUPBY_COMPARISON_OPS = <const>[
  // these are used for groupby
  'gb_eq',
  'gb_null',
];

export const COMPARISON_OPS = <const>[
  'eq',
  'neq',
  'not',
  'like',
  'nlike',
  'empty',
  'notempty',
  'null',
  'notnull',
  'checked',
  'notchecked',
  'blank',
  'notblank',
  'allof',
  'anyof',
  'nallof',
  'nanyof',
  'gt',
  'lt',
  'gte',
  'lte',
  'ge',
  'le',
  'in',
  'isnot',
  'is',
  'isWithin',
  'btw',
  'nbtw',
];

export const COMPARISON_OPS_ALIAS = <const>[
  'isblank',
  'is_blank',
  'isnotblank',
  'is_not_blank',
  'is_notblank',
];

// `isWithin` sub-ops bounded by calendar periods, not rolling windows from today.
export const CALENDAR_PERIOD_SUB_OPS = [
  'thisCalendarWeek',
  'thisCalendarMonth',
  'thisCalendarYear',
  'lastCalendarWeek',
  'lastCalendarMonth',
  'lastCalendarYear',
  'nextCalendarWeek',
  'nextCalendarMonth',
  'nextCalendarYear',
] as const;

// `isWithin` + `dateRange`: value is "from,to" (dates), both days inclusive.
export const DATE_RANGE_SUB_OP = 'dateRange' as const;

export const IS_WITHIN_COMPARISON_SUB_OPS = <const>[
  'pastWeek',
  'pastMonth',
  'pastYear',
  'nextWeek',
  'nextMonth',
  'nextYear',
  'pastNumberOfDays',
  'nextNumberOfDays',
  ...CALENDAR_PERIOD_SUB_OPS,
  DATE_RANGE_SUB_OP,
];

// Sub-ops whose value is a number of days.
export const DAY_COUNT_COMPARISON_SUB_OPS = <const>[
  'daysAgo',
  'daysFromNow',
  'pastNumberOfDays',
  'nextNumberOfDays',
];

export const COMPARISON_SUB_OPS = <const>[
  'today',
  'tomorrow',
  'yesterday',
  'oneWeekAgo',
  'oneWeekFromNow',
  'oneMonthAgo',
  'oneMonthFromNow',
  'daysAgo',
  'daysFromNow',
  'exactDate',
  ...IS_WITHIN_COMPARISON_SUB_OPS,
];
