export const ADD_WORDS = [
  'add',
  'plus',
  'increase',
  'raise',
  'bump',
  'boost',
  'up',
  'more',
  'push',
  'postpone',
  'delay',
  'extend',
  'move',
  'shift',
]
export const SUB_WORDS = ['subtract', 'minus', 'decrease', 'reduce', 'lower', 'drop', 'cut', 'deduct', 'less', 'down', 'rewind']
export const MUL_WORDS = ['multiply', 'times', 'x']
export const DIV_WORDS = ['divide']

export const VERB_ALIASES: Record<string, string> = {
  ad: 'add',
  sub: 'subtract',
  mult: 'multiply',
  mul: 'multiply',
  div: 'divide',
}

/** Absolute edits: "set stage to won", "change amount = 5". */
export const SET_VERBS = new Set(['set', 'change', 'update', 'make', 'put'])

/** "clear notes", "empty owner". */
export const CLEAR_VERBS = new Set(['clear', 'empty', 'blank', 'unset', 'reset'])

export const TEXT_CASE_OPS: Record<string, 'upper' | 'lower' | 'title' | 'capitalize' | 'trim'> = {
  uppercase: 'upper',
  lowercase: 'lower',
  titlecase: 'title',
  capitalize: 'capitalize',
  capitalise: 'capitalize',
  trim: 'trim',
}

/** Sort verbs and direction words ("sort by amount desc", "lowest first"). */
export const SORT_VERBS = new Set(['sort', 'sorted', 'order', 'ordered', 'rank', 'ranked', 'arrange'])
export const SORT_DIRECTIONS: Record<string, 'asc' | 'desc'> = {
  asc: 'asc',
  ascending: 'asc',
  desc: 'desc',
  descending: 'desc',
  increasing: 'asc',
  decreasing: 'desc',
}

/** Whole phrases that set a sort direction ("high to low", "newest first", "z to a"). */
export const SORT_PHRASES: Array<[string[], 'asc' | 'desc']> = [
  [['high', 'to', 'low'], 'desc'],
  [['highest', 'to', 'lowest'], 'desc'],
  [['largest', 'to', 'smallest'], 'desc'],
  [['biggest', 'to', 'smallest'], 'desc'],
  [['low', 'to', 'high'], 'asc'],
  [['lowest', 'to', 'highest'], 'asc'],
  [['smallest', 'to', 'largest'], 'asc'],
  [['smallest', 'to', 'biggest'], 'asc'],
  [['newest', 'to', 'oldest'], 'desc'],
  [['oldest', 'to', 'newest'], 'asc'],
  [['z', 'to', 'a'], 'desc'],
  [['a', 'to', 'z'], 'asc'],
  [['highest', 'first'], 'desc'],
  [['largest', 'first'], 'desc'],
  [['biggest', 'first'], 'desc'],
  [['most', 'first'], 'desc'],
  [['newest', 'first'], 'desc'],
  [['latest', 'first'], 'desc'],
  [['recent', 'first'], 'desc'],
  [['lowest', 'first'], 'asc'],
  [['smallest', 'first'], 'asc'],
  [['least', 'first'], 'asc'],
  [['oldest', 'first'], 'asc'],
  [['earliest', 'first'], 'asc'],
  [['on', 'top'], 'desc'],
  [['at', 'the', 'top'], 'desc'],
  [['first', 'to', 'last'], 'asc'],
  [['last', 'to', 'first'], 'desc'],
  [['cheap', 'to', 'expensive'], 'asc'],
  [['expensive', 'to', 'cheap'], 'desc'],
  [['old', 'to', 'new'], 'asc'],
  [['new', 'to', 'old'], 'desc'],
  [['in', 'descending', 'order'], 'desc'],
  [['in', 'ascending', 'order'], 'asc'],
  [['descending', 'order'], 'desc'],
  [['ascending', 'order'], 'asc'],
  [['reverse', 'order'], 'desc'],
]

/** "group by status", "tasks grouped by status". */
export const GROUP_VERBS = new Set(['group', 'grouped', 'grouping'])

/** "count by assignee", "total per stage", "tasks each assignee has": a group-by after a stat. */
export const PER_WORDS = new Set(['by', 'per', 'each', 'every'])

/** Top-N openers: "top 5 deals", "first 10 tasks". */
export const LIMIT_WORDS = new Set(['top', 'first', 'bottom', 'last'])
