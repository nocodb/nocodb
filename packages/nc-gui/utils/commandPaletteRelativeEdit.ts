import type dayjs from 'dayjs'

export type CmdDateUnit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'

/** A relative change parsed from a Cmd+K query ("add 1m", "+10%", "add 1 week", "next monday"). */
export type CmdRelativeEdit = { field?: string } & (
  | { kind: 'number'; op: 'add'; amount: number }
  | { kind: 'number'; op: 'percent'; amount: number }
  | { kind: 'number'; op: 'multiply'; amount: number }
  | { kind: 'number'; op: 'divide'; amount: number }
  | { kind: 'number'; op: 'round'; amount: number }
  | { kind: 'number'; op: 'negate' }
  | { kind: 'date'; op: 'shift'; amount: number; unit: CmdDateUnit }
  | { kind: 'date'; op: 'next-weekday'; weekday: number }
  | { kind: 'date'; op: 'start-of' | 'end-of'; unit: 'week' | 'month' | 'year' }
)

const NUM = String.raw`(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)`

const MULTIPLIERS: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  m: 1e6,
  mn: 1e6,
  million: 1e6,
  b: 1e9,
  bn: 1e9,
  billion: 1e9,
}

const DATE_UNITS: Record<string, CmdDateUnit> = {
  min: 'minute',
  mins: 'minute',
  minute: 'minute',
  minutes: 'minute',
  h: 'hour',
  hr: 'hour',
  hrs: 'hour',
  hour: 'hour',
  hours: 'hour',
  d: 'day',
  day: 'day',
  days: 'day',
  w: 'week',
  wk: 'week',
  wks: 'week',
  week: 'week',
  weeks: 'week',
  mo: 'month',
  month: 'month',
  months: 'month',
  y: 'year',
  yr: 'year',
  yrs: 'year',
  year: 'year',
  years: 'year',
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

const ADD_WORDS = ['add', 'plus', 'increase', 'raise', 'bump', 'push', 'postpone', 'delay', 'extend', 'move', 'shift']
const SUB_WORDS = ['subtract', 'minus', 'decrease', 'reduce', 'lower', 'deduct', 'rewind']
const MUL_WORDS = ['multiply', 'times', 'x']
const DIV_WORDS = ['divide']

/** Words that join the verb, amount and field name; dropped before the rest is read as a field name. */
const JOIN_WORDS = new Set(['to', 'by', 'from', 'the', 'of', 'in', 'on', 'for', 'field', 'value', 'a', 'an', 'it', 'all', 'with'])

const toNumber = (digits: string, multiplier?: string) =>
  Number(digits.replace(/,/g, '')) * (multiplier ? MULTIPLIERS[multiplier] ?? 1 : 1)

function fieldOf(text: string) {
  const words = text
    .split(' ')
    .map((word) => word.trim())
    .filter((word) => word && !JOIN_WORDS.has(word))
  return words.length ? words.join(' ') : undefined
}

/** Removes the first occurrence of each of `verbs` as a whole word; returns the verb found and the rest. */
function takeVerb(text: string, verbs: string[]) {
  for (const verb of verbs) {
    const match = new RegExp(`(^|\\s)${verb}(\\s|$)`).exec(text)
    if (match) return { verb, rest: `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}` }
  }
  return undefined
}

/**
 * Parses an arithmetic or date change. Needs a number, a date phrase or a numeric verb
 * (double, halve, round…), so "add filter" or "add record" never match. Pure.
 */
export function parseCmdRelativeEdit(query: string): CmdRelativeEdit | undefined {
  let text = ` ${query.toLowerCase().replace(/×/g, 'x').replace(/\s+/g, ' ').trim()} `
  if (!text.trim()) return

  // Dates first: "next monday", "end of month", "+1 week", "add 3 days".
  const weekday = /\snext\s(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s/.exec(text)
  if (weekday) {
    const rest = text.replace(weekday[0], ' ').replace(/\s(move|set|to)\s/g, ' ')
    return { kind: 'date', op: 'next-weekday', weekday: WEEKDAYS.indexOf(weekday[1]!), field: fieldOf(rest) }
  }

  const edge = /\s(start|beginning|end)\sof\s(the\s)?(week|month|year)\s/.exec(text)
  if (edge) {
    const rest = text.replace(edge[0], ' ').replace(/\s(move|set|to)\s/g, ' ')
    const unit = edge[3] as 'week' | 'month' | 'year'
    return { kind: 'date', op: edge[1] === 'end' ? 'end-of' : 'start-of', unit, field: fieldOf(rest) }
  }

  const shift = new RegExp(String.raw`\s([+-])?\s?${NUM}\s?(${Object.keys(DATE_UNITS).join('|')})\s`).exec(text)
  if (shift) {
    let rest = text.replace(shift[0], ' ')
    const sub = takeVerb(rest, SUB_WORDS)
    const add = sub ? undefined : takeVerb(rest, ADD_WORDS)
    if (!shift[1] && !sub && !add) return
    rest = (sub ?? add)?.rest ?? rest
    const negative = shift[1] === '-' || !!sub
    const amount = Number(shift[2]!.replace(/,/g, ''))
    if (!amount) return
    return { kind: 'date', op: 'shift', amount: negative ? -amount : amount, unit: DATE_UNITS[shift[3]!]!, field: fieldOf(rest) }
  }

  // Numbers without an amount.
  const bare = takeVerb(text, ['double', 'triple', 'halve', 'negate'])
  if (bare) {
    if (/\d/.test(bare.rest)) return
    const field = fieldOf(bare.rest)
    if (bare.verb === 'negate') return { kind: 'number', op: 'negate', field }
    return { kind: 'number', op: 'multiply', amount: bare.verb === 'double' ? 2 : bare.verb === 'triple' ? 3 : 0.5, field }
  }

  const round = /\sround(\s(?:to\s)?(\d+)\s(?:decimals?|places?|dp))?\s/.exec(text)
  if (round) {
    const rest = text.replace(round[0], ' ')
    if (/\d/.test(rest)) return
    return { kind: 'number', op: 'round', amount: round[2] ? Number(round[2]) : 0, field: fieldOf(rest) }
  }

  // "+10", "-5", "x2", "/4", "add 1.5m", "increase score by 10%".
  const amountMatch = new RegExp(
    String.raw`(^|\s)([+\-*/x])?\s?${NUM}\s?(${Object.keys(MULTIPLIERS).join('|')})?(%)?(?=\s)`,
  ).exec(text)
  if (!amountMatch) return
  const symbol = amountMatch[2]
  const amount = toNumber(amountMatch[3]!, amountMatch[4])
  const isPercent = !!amountMatch[5]
  text = `${text.slice(0, amountMatch.index)} ${text.slice(amountMatch.index + amountMatch[0].length)} `

  let op: 'add' | 'sub' | 'mul' | 'div' | undefined =
    symbol === '+'
      ? 'add'
      : symbol === '-'
      ? 'sub'
      : symbol === '*' || symbol === 'x'
      ? 'mul'
      : symbol === '/'
      ? 'div'
      : undefined
  for (const [kind, verbs] of [
    ['sub', SUB_WORDS],
    ['add', ADD_WORDS],
    ['mul', MUL_WORDS],
    ['div', DIV_WORDS],
  ] as const) {
    const found = takeVerb(text, verbs)
    if (!found) continue
    op ??= kind
    text = found.rest
    break
  }
  if (!op || !Number.isFinite(amount)) return
  // A second number ("add 10 to row 5") is not something this grammar reads.
  if (/\d/.test(text)) return

  const field = fieldOf(text)
  if (isPercent) {
    if (op === 'add') return { kind: 'number', op: 'percent', amount, field }
    if (op === 'sub') return { kind: 'number', op: 'percent', amount: -amount, field }
    return
  }
  if (op === 'add') return { kind: 'number', op: 'add', amount, field }
  if (op === 'sub') return { kind: 'number', op: 'add', amount: -amount, field }
  if (op === 'mul') return { kind: 'number', op: 'multiply', amount, field }
  if (!amount) return
  return { kind: 'number', op: 'divide', amount, field }
}

/**
 * The new number, `undefined` to leave the value as it is (empty values are only treated as 0
 * by add/subtract), or `NaN` when the result is not a number.
 */
export function applyCmdNumberEdit(edit: CmdRelativeEdit & { kind: 'number' }, prev: unknown): number | undefined {
  const isEmpty = prev === null || prev === undefined || prev === ''
  if (isEmpty && edit.op !== 'add') return
  const value = isEmpty ? 0 : Number(prev)
  if (!Number.isFinite(value)) return NaN

  let next: number
  switch (edit.op) {
    case 'add':
      next = value + edit.amount
      break
    case 'percent':
      next = value * (1 + edit.amount / 100)
      break
    case 'multiply':
      next = value * edit.amount
      break
    case 'divide':
      next = value / edit.amount
      break
    case 'round': {
      const factor = 10 ** edit.amount
      next = Math.round(value * factor) / factor
      break
    }
    case 'negate':
      next = -value
      break
  }
  // Drop float noise such as 0.1 + 0.2.
  return Number.isFinite(next) ? Number(next.toPrecision(15)) : NaN
}

/** The shifted date, or `undefined` for an empty value. `date` is already in the column's timezone. */
export function applyCmdDateEdit(edit: CmdRelativeEdit & { kind: 'date' }, date: dayjs.Dayjs | undefined) {
  if (!date?.isValid()) return
  switch (edit.op) {
    case 'shift':
      return date.add(edit.amount, edit.unit)
    case 'next-weekday': {
      const ahead = (edit.weekday - date.day() + 7) % 7 || 7
      return date.add(ahead, 'day')
    }
    case 'start-of':
      return date.startOf(edit.unit)
    case 'end-of':
      return date.endOf(edit.unit)
  }
}
