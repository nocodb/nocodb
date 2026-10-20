/** `mode` ("most common") has no footer aggregation; it only ever yields an "unsupported" reading. */
export type StatAgg =
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'median'
  | 'range'
  | 'count'
  | 'count_unique'
  | 'count_empty'
  | 'count_filled'
  | 'mode'

/** Longest phrases first, so "number of" wins over "number" and "top value" over "top". */
export const AGG_WORDS: Array<[string[], StatAgg]> = [
  [['how', 'many'], 'count'],
  [['number', 'of'], 'count'],
  [['count', 'of'], 'count'],
  [['count', 'unique'], 'count_unique'],
  [['count', 'distinct'], 'count_unique'],
  [['count', 'empty'], 'count_empty'],
  [['count', 'filled'], 'count_filled'],
  [['most', 'common'], 'mode'],
  [['most', 'frequent'], 'mode'],
  [['least', 'common'], 'mode'],
  [['least', 'frequent'], 'mode'],
  [['top', 'value'], 'mode'],
  [['mode'], 'mode'],
  [['sum'], 'sum'],
  [['total'], 'sum'],
  [['average'], 'avg'],
  [['avg'], 'avg'],
  [['mean'], 'avg'],
  [['median'], 'median'],
  [['min'], 'min'],
  [['minimum'], 'min'],
  [['lowest'], 'min'],
  [['smallest'], 'min'],
  [['earliest'], 'min'],
  [['max'], 'max'],
  [['maximum'], 'max'],
  [['highest'], 'max'],
  [['largest'], 'max'],
  [['biggest'], 'max'],
  [['top'], 'max'],
  [['latest'], 'max'],
  [['range'], 'range'],
  [['count'], 'count'],
  [['unique'], 'count_unique'],
  [['distinct'], 'count_unique'],
]

/**
 * More ways to ask for a figure, read only by the NL parser (the legacy stats parser keeps AGG_WORDS).
 * Longest first; checked before AGG_WORDS.
 */
export const AGG_WORDS_EXTRA: Array<[string[], StatAgg]> = [
  [['how', 'many', 'unique'], 'count_unique'],
  [['how', 'many', 'distinct'], 'count_unique'],
  [['how', 'many', 'different'], 'count_unique'],
  [['number', 'of', 'unique'], 'count_unique'],
  [['number', 'of', 'distinct'], 'count_unique'],
  [['number', 'of', 'different'], 'count_unique'],
  [['how', 'many', 'empty'], 'count_empty'],
  [['how', 'many', 'missing'], 'count_empty'],
  [['how', 'many', 'blank'], 'count_empty'],
  [['how', 'many', 'filled'], 'count_filled'],
  [['count', 'of', 'unique'], 'count_unique'],
  [['count', 'blank'], 'count_empty'],
  [['count', 'missing'], 'count_empty'],
  [['count', 'non', 'empty'], 'count_filled'],
  [['count', 'non-empty'], 'count_filled'],
  [['distinct', 'count'], 'count_unique'],
  [['unique', 'count'], 'count_unique'],
  [['sum', 'total', 'of'], 'sum'],
  [['sum', 'total'], 'sum'],
  [['total', 'of'], 'sum'],
  [['sum', 'of'], 'sum'],
  [['grand', 'total'], 'sum'],
  [['average', 'of'], 'avg'],
  [['mean', 'of'], 'avg'],
  [['median', 'of'], 'median'],
  [['range', 'of'], 'range'],
  [['highest', 'value', 'of'], 'max'],
  [['lowest', 'value', 'of'], 'min'],
  [['largest', 'value', 'of'], 'max'],
  [['smallest', 'value', 'of'], 'min'],
  [['combined'], 'sum'],
  [['aggregate'], 'sum'],
  [['overall'], 'sum'],
  [['cumulative'], 'sum'],
  [['tally'], 'count'],
  [['greatest'], 'max'],
  [['peak'], 'max'],
  [['most'], 'max'],
  [['fewest'], 'min'],
  [['least'], 'min'],
  [['typical'], 'median'],
  [['middle'], 'median'],
  [['midpoint'], 'median'],
  [['spread'], 'range'],
  [['soonest'], 'min'],
  [['furthest'], 'max'],
  [['farthest'], 'max'],
  [['newest'], 'max'],
  [['oldest'], 'min'],
  [['avg.'], 'avg'],
  [['av'], 'avg'],
  [['ave'], 'avg'],
]

const PERCENT_HEADS = ['percent', 'percentage', 'pct', '%']

/** "percent of revenue where …", "share of deals that …": a share of the total, not a footer percent_*. */
export const SHARE_WORDS: Array<[string[], true]> = [
  ...PERCENT_HEADS.map((w): [string[], true] => [[w], true]),
  [['percent', 'share'], true],
  [['share'], true],
  [['proportion'], true],
  [['fraction'], true],
  [['portion'], true],
]

/** The footer's own percentages: "percent empty", "% filled", "percentage checked". */
export const PERCENT_AGG_WORDS: Array<[string[], string]> = PERCENT_HEADS.flatMap((head) => [
  [[head, 'empty'], 'percent_empty'],
  [[head, 'blank'], 'percent_empty'],
  [[head, 'missing'], 'percent_empty'],
  [[head, 'filled'], 'percent_filled'],
  [[head, 'unique'], 'percent_unique'],
  [[head, 'distinct'], 'percent_unique'],
  [[head, 'checked'], 'percent_checked'],
  [[head, 'ticked'], 'percent_checked'],
  [[head, 'unchecked'], 'percent_unchecked'],
  [[head, 'unticked'], 'percent_unchecked'],
])

/** On date fields, min/max/range are the footer's date aggregations. */
export const DATE_AGG: Partial<Record<StatAgg, string>> = { min: 'earliest_date', max: 'latest_date', range: 'date_range' }

/** "first close date" / "last close date": only an aggregation right before a date field. */
export const DATE_ONLY_AGG: Record<string, StatAgg> = {
  first: 'min',
  last: 'max',
  oldest: 'min',
  newest: 'max',
  next: 'min',
  upcoming: 'min',
  soonest: 'min',
  furthest: 'max',
}

/** Superlatives that order records ("biggest deals first", "5 smallest orders"): direction of the sort. */
export const SORT_SUPERLATIVES: Record<string, 'asc' | 'desc'> = {
  biggest: 'desc',
  largest: 'desc',
  highest: 'desc',
  most: 'desc',
  top: 'desc',
  latest: 'desc',
  newest: 'desc',
  smallest: 'asc',
  lowest: 'asc',
  least: 'asc',
  earliest: 'asc',
  oldest: 'asc',
  bottom: 'asc',
  priciest: 'desc',
  costliest: 'desc',
  dearest: 'desc',
  cheapest: 'asc',
  soonest: 'asc',
  fewest: 'asc',
  longest: 'desc',
  shortest: 'asc',
}
