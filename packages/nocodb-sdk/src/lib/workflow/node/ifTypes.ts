export enum WorkflowNodeComparisonOp {
  EQ = 'eq',
  NEQ = 'neq',
  LIKE = 'like',
  NLIKE = 'nlike',
  GT = 'gt',
  LT = 'lt',
  GTE = 'gte',
  LTE = 'lte',
  EMPTY = 'empty',
  NOT_EMPTY = 'notempty',
  NULL = 'null',
  NOT_NULL = 'notnull',
  BLANK = 'blank',
  NOT_BLANK = 'notblank',
  CHECKED = 'checked',
  NOT_CHECKED = 'notchecked',
  ALL_OF = 'allof',
  ANY_OF = 'anyof',
  NOT_ALL_OF = 'nallof',
  NOT_ANY_OF = 'nanyof',
  IS_WITHIN = 'isWithin',
}

export enum WorkflowNodeComparisonSubOp {
  TODAY = 'today',
  TOMORROW = 'tomorrow',
  YESTERDAY = 'yesterday',
  ONE_WEEK_AGO = 'oneWeekAgo',
  ONE_WEEK_FROM_NOW = 'oneWeekFromNow',
  ONE_MONTH_AGO = 'oneMonthAgo',
  ONE_MONTH_FROM_NOW = 'oneMonthFromNow',
  DAYS_AGO = 'daysAgo',
  DAYS_FROM_NOW = 'daysFromNow',
  EXACT_DATE = 'exactDate',
  PAST_WEEK = 'pastWeek',
  PAST_MONTH = 'pastMonth',
  PAST_YEAR = 'pastYear',
  NEXT_WEEK = 'nextWeek',
  NEXT_MONTH = 'nextMonth',
  NEXT_YEAR = 'nextYear',
  PAST_NUMBER_OF_DAYS = 'pastNumberOfDays',
  NEXT_NUMBER_OF_DAYS = 'nextNumberOfDays',
}

export enum WorkflowNodeFilterDataType {
  TEXT = 'text',
  NUMBER = 'number',
  DATE = 'date',
  DATETIME = 'datetime',
  BOOLEAN = 'boolean',
  SELECT = 'select',
  MULTI_SELECT = 'multiSelect',
  JSON = 'json',
}

export interface WorkflowNodeFilterCondition {
  field: string;
  dataType?: WorkflowNodeFilterDataType;
  comparison_op: WorkflowNodeComparisonOp;
  comparison_sub_op?: WorkflowNodeComparisonSubOp;
  value?: any;
  logical_op?: 'and' | 'or';
}

export interface WorkflowNodeConditionGroup {
  is_group: true;
  logical_op: 'and' | 'or';
  children: WorkflowNodeConditionItem[];
}

export type WorkflowNodeConditionItem =
  | WorkflowNodeFilterCondition
  | WorkflowNodeConditionGroup;
