export type CmdDateUnit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'

/** Units read after a number in date edits. "m" is minutes here; on numbers it's million. */
export const DATE_UNITS: Record<string, [CmdDateUnit, number]> = {
  m: ['minute', 1],
  min: ['minute', 1],
  mins: ['minute', 1],
  minute: ['minute', 1],
  minutes: ['minute', 1],
  h: ['hour', 1],
  hr: ['hour', 1],
  hrs: ['hour', 1],
  hour: ['hour', 1],
  hours: ['hour', 1],
  d: ['day', 1],
  day: ['day', 1],
  days: ['day', 1],
  w: ['week', 1],
  wk: ['week', 1],
  wks: ['week', 1],
  week: ['week', 1],
  weeks: ['week', 1],
  fortnight: ['week', 2],
  fortnights: ['week', 2],
  mo: ['month', 1],
  mos: ['month', 1],
  mth: ['month', 1],
  mths: ['month', 1],
  month: ['month', 1],
  months: ['month', 1],
  y: ['year', 1],
  yr: ['year', 1],
  yrs: ['year', 1],
  year: ['year', 1],
  years: ['year', 1],
}

export const WEEKDAY_NAMES: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
}

export const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

/** Month names and abbreviations → month index ("sept" and "september" too). */
export const MONTH_NAMES: Record<string, number> = Object.fromEntries([
  ...MONTHS.map((m, i) => [m, i] as const),
  ...[
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ].map((m, i) => [m, i] as const),
  ['sept', 8] as const,
])

/** Words that name "a date" without one: dropped after a date field ("no due date", "close date"). */
export const DATE_NOUNS = new Set(['date', 'dates', 'day', 'time', 'deadline'])

/** Field-less date phrases with a fixed meaning against the field they're attached to. */
export const DATE_DAY_WORDS: Record<string, 'today' | 'tomorrow' | 'yesterday'> = {
  today: 'today',
  tomorrow: 'tomorrow',
  yesterday: 'yesterday',
}

/**
 * Words that can start a date phrase, so the grammar asks the date reader about them (weekdays,
 * day words and month names are added by the grammar). New relative-date words belong here.
 */
export const DATE_TRIGGER_WORDS = [
  'next',
  'last',
  'this',
  'coming',
  'previous',
  'current',
  'ago',
  'tonight',
  'noon',
  'midnight',
  'quarter',
  'qtr',
  'ytd',
  'mtd',
]
