import dayjs from 'dayjs'

export type CmdDateUnit = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'

export type CmdDatePeriod = 'week' | 'month' | 'year'

/** A change parsed from a Cmd+K query ("add 1m", "+10%", "add a week", "uppercase name", "toggle done"). */
export type CmdRelativeEdit = { field?: string } & (
  | { kind: 'number'; op: 'add'; amount: number; unit?: 'points' | 'stars' }
  | { kind: 'number'; op: 'percent' | 'multiply' | 'divide' | 'round' | 'round-nearest' | 'at-least' | 'at-most'; amount: number }
  | { kind: 'number'; op: 'negate' | 'abs' | 'floor' | 'ceil' }
  | { kind: 'date'; op: 'shift'; amount: number; unit: CmdDateUnit }
  | { kind: 'date'; op: 'weekday'; weekday: number; which: 'next' | 'this' | 'last' }
  | { kind: 'date'; op: 'start-of' | 'end-of'; unit: CmdDatePeriod; offset: number }
  | { kind: 'text'; op: 'append' | 'prepend' | 'remove'; text: string }
  | { kind: 'text'; op: 'replace'; from: string; to: string }
  | { kind: 'text'; op: 'upper' | 'lower' | 'title' | 'capitalize' | 'trim' | 'https' }
  | { kind: 'checkbox'; op: 'toggle' | 'check' | 'uncheck' }
  | { kind: 'select'; op: 'next' | 'previous' | 'cycle' }
  // Option and user edits only become rows when `option`/`who` matches the target field's data.
  | { kind: 'option'; op: 'add' | 'remove' | 'toggle'; option: string }
  | { kind: 'option'; op: 'clear' }
  | { kind: 'user'; op: 'add' | 'remove'; who: string }
)

const NUM = String.raw`(\d+(?:\.\d+)?e\d+|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)`

const MULTIPLIERS: Record<string, number> = {
  k: 1e3,
  thousand: 1e3,
  hundred: 1e2,
  dozen: 12,
  m: 1e6,
  mn: 1e6,
  mil: 1e6,
  million: 1e6,
  b: 1e9,
  bn: 1e9,
  billion: 1e9,
}

/** Units read after a number in date edits. "m" is minutes here; on numbers it's million. */
const DATE_UNITS: Record<string, [CmdDateUnit, number]> = {
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

const WEEKDAY_NAMES: Record<string, number> = {
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

const WORD_NUMBERS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  couple: 2,
}

const ADD_WORDS = [
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
const SUB_WORDS = ['subtract', 'minus', 'decrease', 'reduce', 'lower', 'drop', 'cut', 'deduct', 'less', 'down', 'rewind']
const MUL_WORDS = ['multiply', 'times', 'x']
const DIV_WORDS = ['divide']

/** Multi-word phrases folded into one verb before reading. */
const PHRASES: Array<[RegExp, string]> = [
  [/\s(knock|take)\s(off|away)\s/g, ' subtract '],
  [/\s(bring|pull)\s(forward|earlier)\s/g, ' subtract '],
  [/\spush\sback\s/g, ' add '],
  [/\sbump\sup\s/g, ' add '],
  [/\s(upper)\s?case\s/g, ' uppercase '],
  [/\s(lower)\s?case\s/g, ' lowercase '],
  [/\stitle\s?case\s/g, ' titlecase '],
  [/\sround\s(down)\s/g, ' floor '],
  [/\sround\s(up)\s/g, ' ceil '],
  // Units only right after a number, so a field called "Pct" or "Stars" stays a field name.
  [/(\d)\s?(per\scent|percent|pct)\s/g, '$1% '],
  [/(\d)\s(percentage\s)?(points?|pts|pp)\s/g, '$1 points '],
  [/(\d)\sstars?\s/g, '$1 stars '],
  [/\sno\sless\sthan\s/g, ' atleast '],
  [/\sat\sleast\s/g, ' atleast '],
  [/\sno\smore\sthan\s/g, ' atmost '],
  [/\s(at\smost|cap\sat|capped\sat|limit\sto|cap)\s/g, ' atmost '],
  [/\sabsolute(\svalue)?\s/g, ' abs '],
  [/\sceiling\s/g, ' ceil '],
]

/** Typos tolerated in the verb (first word) and in a unit right after a number. */
const VERB_VOCAB = [
  ...ADD_WORDS,
  ...SUB_WORDS,
  'multiply',
  'divide',
  'double',
  'triple',
  'halve',
  'negate',
  'round',
  'append',
  'prepend',
  'prefix',
  'suffix',
  'replace',
  'remove',
  'uppercase',
  'lowercase',
  'titlecase',
  'capitalize',
  'trim',
  'toggle',
  'check',
  'uncheck',
  'untick',
  'assign',
  'unassign',
  'cycle',
]
const VERB_ALIASES: Record<string, string> = { ad: 'add', sub: 'subtract', mult: 'multiply', mul: 'multiply', div: 'divide' }
const UNIT_VOCAB = [
  ...Object.keys(DATE_UNITS).filter((unit) => unit.length >= 4),
  'points',
  'stars',
  'million',
  'thousand',
  'billion',
]

/** Words that join the verb, amount and field name; dropped before the rest is read as a field name. */
const JOIN_WORDS = new Set([
  'to',
  'by',
  'from',
  'the',
  'of',
  'in',
  'into',
  'on',
  'onto',
  'for',
  'field',
  'value',
  'values',
  'a',
  'an',
  'it',
  'all',
  'with',
  'as',
  'make',
  'set',
  'convert',
  'change',
])

const TEXT_CASE_OPS: Record<string, 'upper' | 'lower' | 'title' | 'capitalize' | 'trim'> = {
  uppercase: 'upper',
  lowercase: 'lower',
  titlecase: 'title',
  capitalize: 'capitalize',
  capitalise: 'capitalize',
  trim: 'trim',
}

/** One edit (insert, delete, substitute or swap of neighbours) apart. */
function isOneEditApart(a: string, b: string) {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  if (a.length === b.length) {
    const diff = [...a].reduce<number[]>((acc, char, i) => (char === b[i] ? acc : [...acc, i]), [])
    if (diff.length === 1) return true
    return diff.length === 2 && diff[1] === diff[0]! + 1 && a[diff[0]!] === b[diff[1]!] && a[diff[1]!] === b[diff[0]!]
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a]
  for (let i = 0; i < long.length; i++) if (long.slice(0, i) + long.slice(i + 1) === short) return true
  return false
}

/** The vocabulary word a typo means, when exactly one is a single edit away (words of 4+ letters). */
function correct(word: string, vocab: string[]) {
  if (vocab.includes(word) || word.length < 4) return word
  const hits = [...new Set(vocab.filter((candidate) => candidate.length >= 4 && isOneEditApart(word, candidate)))]
  return hits.length === 1 ? hits[0]! : word
}

/** True when a field-name word refers to a title word: a prefix, or a one-letter typo in a long word. */
export function cmdFieldWordMatches(word: string, titleWord: string) {
  if (titleWord.startsWith(word)) return true
  return word.length >= 5 && isOneEditApart(word, titleWord)
}

/** Lowercased query with quotes pulled out, phrases folded, word numbers as digits and typos fixed. */
function normalize(query: string) {
  const quotes: string[] = []
  // "…", “…”, ‘…’ and '…' (only at word edges, so "name's" stays a word).
  let raw = ` ${query.replace(/\s+/g, ' ').trim()} `
  raw = raw.replace(/"([^"]*)"|“([^”]*)”|‘([^’]*)’|(?<=\s)'([^']*)'(?=\s)/g, (_, a, b, c, d) => {
    quotes.push(a ?? b ?? c ?? d ?? '')
    return ` ¤${quotes.length - 1} `
  })

  let text = ` ${raw
    .toLowerCase()
    .replace(/×/g, 'x')
    .replace(/(\w)'s\b/g, '$1')
    .replace(/[!?;:]/g, ' ')
    .replace(/[$€£¥₹]\s?(?=[\d.])/g, ' ')
    .replace(/(\d)\s?(usd|eur|gbp|inr|jpy|aud|cad)\b/g, '$1')
    .replace(/,(?!\d{3})/g, ' ')
    .replace(/\.(?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `

  for (const [pattern, replacement] of PHRASES) text = text.replace(pattern, replacement)

  const tokens = text.trim().split(' ')
  const out: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i]!
    const next = tokens[i + 1]
    if (i === 0) token = VERB_ALIASES[token] ?? correct(token, VERB_VOCAB)
    if (i > 0 && /\d$/.test(out[out.length - 1] ?? '')) token = correct(token, UNIT_VOCAB)

    // "a/an" before a unit or multiplier, "half (a|an)", "a couple of", word numbers.
    if ((token === 'a' || token === 'an') && next && (DATE_UNITS[next] || MULTIPLIERS[next] || next === 'couple')) {
      if (next === 'couple') continue
      out.push('1')
      continue
    }
    if (token === 'half') {
      if (next === 'a' || next === 'an') i++
      out.push('0.5')
      continue
    }
    if (token in WORD_NUMBERS) {
      let value = WORD_NUMBERS[token]!
      if (value >= 20 && value % 10 === 0 && tokens[i + 1] && WORD_NUMBERS[tokens[i + 1]!]! < 10)
        value += WORD_NUMBERS[tokens[++i]!]!
      if (tokens[i + 1] === 'of') i++
      out.push(String(value))
      continue
    }
    out.push(token)
  }

  return { text: ` ${out.join(' ')} `, quotes }
}

function fieldOf(text: string) {
  const words = text
    .replace(/¤\d+/g, ' ')
    .split(' ')
    .map((word) => word.trim())
    .filter((word) => word && !JOIN_WORDS.has(word))
  return words.length ? words.join(' ') : undefined
}

/** Removes the first occurrence of each of `verbs` as a whole word; returns the verb found and the rest. */
function takeVerb(text: string, verbs: string[]) {
  for (const verb of verbs) {
    const match = new RegExp(`(^|\\s)${verb}(\\s|$)`).exec(text)
    if (match) return { verb, rest: ` ${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)} ` }
  }
  return undefined
}

/** The original-case words of `raw` after the verb, for unquoted text payloads. */
function rawWordsAfterVerb(query: string) {
  return query.replace(/\s+/g, ' ').trim().split(' ').slice(1)
}

/** Splits trailing "<sep> <field>" off a payload; the last separator wins so the text may contain it. */
function splitField(words: string[], separators: string[]) {
  const at = words
    .map((word) => word.toLowerCase())
    .lastIndexOf(separators.find((sep) => words.some((w) => w.toLowerCase() === sep)) ?? '')
  if (at <= 0) return { payload: words.join(' '), field: undefined }
  return {
    payload: words.slice(0, at).join(' '),
    field: fieldOf(
      ` ${words
        .slice(at + 1)
        .join(' ')
        .toLowerCase()} `,
    ),
  }
}

function parseText(query: string, text: string, quotes: string[]): CmdRelativeEdit | undefined {
  const verb = text.trim().split(' ')[0]
  const quoted = quotes[0]
  const restAfterVerb = text.replace(` ${verb} `, ' ')

  if (
    verb === 'append' ||
    verb === 'suffix' ||
    verb === 'prepend' ||
    verb === 'prefix' ||
    (verb === 'add' && quoted !== undefined)
  ) {
    const op = verb === 'prepend' || verb === 'prefix' ? 'prepend' : 'append'
    if (quoted !== undefined) return quoted ? { kind: 'text', op, text: quoted, field: fieldOf(restAfterVerb) } : undefined
    const { payload, field } = splitField(rawWordsAfterVerb(query), ['to', 'onto', 'on'])
    return payload ? { kind: 'text', op, text: payload, field } : undefined
  }

  if (verb === 'replace') {
    if (quotes.length >= 2) {
      return quotes[0]
        ? { kind: 'text', op: 'replace', from: quotes[0], to: quotes[1]!, field: fieldOf(restAfterVerb.replace(/\swith\s/, ' ')) }
        : undefined
    }
    const words = rawWordsAfterVerb(query)
    const withAt = words.findIndex((word) => word.toLowerCase() === 'with')
    if (withAt <= 0) return
    const { payload, field } = splitField(words.slice(withAt + 1), ['in', 'on'])
    return { kind: 'text', op: 'replace', from: words.slice(0, withAt).join(' '), to: payload, field }
  }

  // Unquoted "remove …" is a command ("remove grouping"), so removing text needs quotes.
  if ((verb === 'remove' || verb === 'strip') && quoted) {
    return { kind: 'text', op: 'remove', text: quoted, field: fieldOf(restAfterVerb) }
  }

  const caseHit = takeVerb(text, Object.keys(TEXT_CASE_OPS))
  if (caseHit && !/\d/.test(caseHit.rest)) {
    return { kind: 'text', op: TEXT_CASE_OPS[caseHit.verb]!, field: fieldOf(caseHit.rest) }
  }
}

function parseCheckbox(text: string): CmdRelativeEdit | undefined {
  const verb = text.trim().split(' ')[0]!
  const op = (
    {
      toggle: 'toggle',
      check: 'check',
      tick: 'check',
      mark: 'check',
      uncheck: 'uncheck',
      untick: 'uncheck',
      unmark: 'uncheck',
    } as const
  )[verb as 'toggle']
  if (!op) return
  const rest = text.replace(` ${verb} `, ' ')
  if (/\d/.test(rest)) return
  return { kind: 'checkbox', op, field: fieldOf(rest) }
}

/** Words after the verb as typed (emails, "In-progress" kept), trailing punctuation dropped. */
function payloadWords(query: string) {
  return rawWordsAfterVerb(query.replace(/[!?;]+\s*$/, ''))
}

/** "add urgent to tags", "remove urgent", "toggle urgent", "clear tags": matched against options later. */
function parseOption(query: string, text: string): CmdRelativeEdit | undefined {
  const verb = text.trim().split(' ')[0]
  if (verb === 'clear') {
    const field = fieldOf(text.replace(' clear ', ' '))
    // A bare "clear" is Clear cells / Clear selection; clearing options needs the field named.
    return field && !/\d/.test(field) ? { kind: 'option', op: 'clear', field } : undefined
  }
  if (verb !== 'add' && verb !== 'remove' && verb !== 'toggle') return
  const { payload, field } = splitField(
    payloadWords(query),
    verb === 'add' ? ['to', 'on'] : verb === 'remove' ? ['from', 'on'] : ['on', 'in'],
  )
  return payload ? { kind: 'option', op: verb, option: payload, field } : undefined
}

/** "assign me", "assign ann@acme.com", "unassign ann from owner", "add me", "remove me". */
function parseUser(query: string, text: string): CmdRelativeEdit | undefined {
  const verb = text.trim().split(' ')[0]
  const isAssign = verb === 'assign' || verb === 'unassign'
  const words = payloadWords(query)
  if (!isAssign && !((verb === 'add' || verb === 'remove') && words.length)) return
  const op = verb === 'assign' || verb === 'add' ? 'add' : 'remove'
  const { payload, field } = splitField(words, op === 'add' ? ['to', 'as', 'on'] : ['from', 'on', 'as'])
  return payload ? { kind: 'user', op, who: payload, field } : undefined
}

function parseSelect(text: string): CmdRelativeEdit | undefined {
  const cycle = /^\scycle(\s.+?)?\s$/.exec(text)
  if (cycle)
    return { kind: 'select', op: 'cycle', field: fieldOf(` ${(cycle[1] ?? '').replace(/\b(option|options|value)\b/, '')} `) }
  const match = /^\s(next|previous|prev)\s(.+?)\s$/.exec(text)
  if (!match || /\d/.test(match[2]!)) return
  const op = match[1] === 'next' ? 'next' : 'previous'
  // "next option" targets the active field; "next stage" / "next stage option" names it.
  const field = fieldOf(` ${match[2]!.replace(/\s?\b(option|value)$/, '')} `)
  return field ? { kind: 'select', op, field } : { kind: 'select', op }
}

function parseDate(text: string): CmdRelativeEdit | undefined {
  // An absolute target ("a week from now") is a Set field date, not a shift of the current value.
  if (/\sfrom\s(now|today)\s/.test(text)) return

  const weekday = new RegExp(
    String.raw`\s(next|this|coming|last|previous|prev)\s(${Object.keys(WEEKDAY_NAMES).join('|')})\s`,
  ).exec(text)
  if (weekday) {
    const rest = text.replace(weekday[0], ' ').replace(/\s(move|set|to)\s/g, ' ')
    const which = weekday[1] === 'next' ? 'next' : weekday[1] === 'this' || weekday[1] === 'coming' ? 'this' : 'last'
    return { kind: 'date', op: 'weekday', weekday: WEEKDAY_NAMES[weekday[2]!]!, which, field: fieldOf(rest) }
  }

  const abbrev = /\s(eo|so)(w|m|y)\s/.exec(text)
  const edge = abbrev ?? /\s(start|beginning|end)\sof\s(?:the\s)?(?:(next|last|previous|this)\s)?(week|month|year)\s/.exec(text)
  if (edge) {
    const rest = text.replace(edge[0], ' ').replace(/\s(move|set|to)\s/g, ' ')
    const unit = abbrev ? ({ w: 'week', m: 'month', y: 'year' } as const)[abbrev[2] as 'w'] : (edge[3] as CmdDatePeriod)
    const op = (abbrev ? abbrev[1] === 'eo' : edge[1] === 'end') ? 'end-of' : 'start-of'
    const offset = !abbrev && edge[2] === 'next' ? 1 : !abbrev && (edge[2] === 'last' || edge[2] === 'previous') ? -1 : 0
    return { kind: 'date', op, unit, offset, field: fieldOf(rest) }
  }

  // "next week", "last month", "same day next month", "next hour": one unit either way.
  const step = /\s(?:same\sday\s)?(next|following|last|previous)\s(minute|hour|day|week|month|year)\s/.exec(text)
  if (step) {
    const rest = text.replace(step[0], ' ').replace(/\s(move|set|to)\s/g, ' ')
    if (/\d/.test(rest)) return
    const amount = step[1] === 'next' || step[1] === 'following' ? 1 : -1
    return { kind: 'date', op: 'shift', amount, unit: step[2] as CmdDateUnit, field: fieldOf(rest) }
  }

  const shift = new RegExp(String.raw`\s([+-])?\s?${NUM}\s?(${Object.keys(DATE_UNITS).join('|')})\s`).exec(text)
  if (!shift) return
  let rest = ` ${text.replace(shift[0], ' ')} `
  // "in 2 days", "2 days later/after", "2 days earlier/before/ago/back".
  const after = takeVerb(rest, ['later', 'after', 'in'])
  const before = after ? undefined : takeVerb(rest, ['earlier', 'before', 'ago', 'back'])
  rest = (after ?? before)?.rest ?? rest
  const sub = before ? undefined : takeVerb(rest, SUB_WORDS)
  const add = sub || before || after ? undefined : takeVerb(rest, ADD_WORDS)
  if (!shift[1] && !sub && !add && !after && !before) return
  rest = (sub ?? add)?.rest ?? rest
  if (/\d/.test(rest)) return

  const [baseUnit, factor] = DATE_UNITS[shift[3]!]!
  let unit = baseUnit
  let amount = Number(shift[2]!.replace(/,/g, '')) * factor
  if (!amount || !Number.isFinite(amount)) return
  // Fractions move to a smaller unit ("half a day" → 12 hours); dayjs rounds fractional days.
  const smaller: Partial<Record<CmdDateUnit, [CmdDateUnit, number]>> = {
    year: ['month', 12],
    week: ['day', 7],
    day: ['hour', 24],
    hour: ['minute', 60],
  }
  while (!Number.isInteger(amount) && smaller[unit]) {
    const [nextUnit, mult] = smaller[unit]!
    unit = nextUnit
    amount = Number((amount * mult).toPrecision(12))
  }
  if (!Number.isInteger(amount)) return
  const negative = shift[1] === '-' || !!sub || !!before
  return { kind: 'date', op: 'shift', amount: negative ? -amount : amount, unit, field: fieldOf(rest) }
}

function parseNumber(source: string): CmdRelativeEdit | undefined {
  let text = source

  const bare = takeVerb(text, ['double', 'triple', 'halve', 'negate', 'abs', 'floor', 'ceil'])
  if (bare) {
    if (/\d/.test(bare.rest)) return
    const field = fieldOf(bare.rest)
    if (bare.verb === 'negate' || bare.verb === 'abs' || bare.verb === 'floor' || bare.verb === 'ceil') {
      return { kind: 'number', op: bare.verb, field }
    }
    return { kind: 'number', op: 'multiply', amount: bare.verb === 'double' ? 2 : bare.verb === 'triple' ? 3 : 0.5, field }
  }

  const nearest = new RegExp(String.raw`\sround\s(?:to\s)?(?:the\s)?nearest\s${NUM}\s`).exec(text)
  if (nearest) {
    const rest = text.replace(nearest[0], ' ')
    const amount = Number(nearest[1]!.replace(/,/g, ''))
    if (/\d/.test(rest) || !amount) return
    return { kind: 'number', op: 'round-nearest', amount, field: fieldOf(rest) }
  }

  const round = /\sround(\s(?:to\s)?(\d+)\s(?:decimals?|places?|dp|digits?))?\s/.exec(text)
  if (round) {
    const rest = text.replace(round[0], ' ')
    if (/\d/.test(rest)) return
    return { kind: 'number', op: 'round', amount: round[2] ? Number(round[2]) : 0, field: fieldOf(rest) }
  }

  // "at least 10", "min 5", "cap score at 100": min/max must sit right before the number.
  const clamp = new RegExp(String.raw`\s(atleast|min|minimum|atmost|max|maximum)\s((?:[a-z][\w-]*\s)*?)(?:at\s)?${NUM}\s`).exec(
    text,
  )
  if (clamp && (!clamp[2] || clamp[1] === 'atleast' || clamp[1] === 'atmost')) {
    const rest = `${text.replace(clamp[0], ' ')} ${clamp[2] ?? ''} `
    const amount = Number(clamp[3]!.replace(/,/g, ''))
    if (/\d/.test(rest) || !Number.isFinite(amount)) return
    const op = clamp[1] === 'atleast' || clamp[1] === 'min' || clamp[1] === 'minimum' ? 'at-least' : 'at-most'
    return { kind: 'number', op, amount, field: fieldOf(rest) }
  }

  // "+10", "-5", "x2", "/4", "add 1.5m", "increase score by 10%", "+5 points", "+1 star".
  const amountMatch = new RegExp(
    String.raw`(^|\s)([+\-*/x])?\s?${NUM}\s?(${Object.keys(MULTIPLIERS).join('|')})?(%)?(?=\s)(\s(?:points|stars)(?=\s))?`,
  ).exec(text)
  if (!amountMatch) return
  const symbol = amountMatch[2]
  const amount = Number(amountMatch[3]!.replace(/,/g, '')) * (amountMatch[4] ? MULTIPLIERS[amountMatch[4]] ?? 1 : 1)
  const isPercent = !!amountMatch[5]
  const unit = amountMatch[6]?.trim() as 'points' | 'stars' | undefined
  text = ` ${text.slice(0, amountMatch.index)} ${text.slice(amountMatch.index + amountMatch[0].length)} `
  if (!Number.isFinite(amount)) return

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
    // "-5% less" or "+10 more" keep the sign the symbol gave.
    op ??= kind
    text = found.rest
    break
  }
  if (!op) return
  // A second number ("add 10 to row 5") is not something this grammar reads.
  if (/\d/.test(text)) return

  const field = fieldOf(text)
  if (isPercent) {
    if (op === 'add') return { kind: 'number', op: 'percent', amount, field }
    if (op === 'sub') return { kind: 'number', op: 'percent', amount: -amount, field }
    return
  }
  if (op === 'add' || op === 'sub') {
    const signed = op === 'sub' ? -amount : amount
    return unit
      ? { kind: 'number', op: 'add', amount: signed, unit, field }
      : { kind: 'number', op: 'add', amount: signed, field }
  }
  if (unit) return
  if (op === 'mul') return { kind: 'number', op: 'multiply', amount, field }
  if (!amount) return
  return { kind: 'number', op: 'divide', amount, field }
}

/**
 * Every reading of a query as an edit, most specific first. "+30m" reads as 30 minutes on
 * date-times and 30 million on numbers, so both are returned. Pure.
 */
export function parseCmdRelativeEdits(query: string): CmdRelativeEdit[] {
  if (!query.trim()) return []

  // "add https://" (to urls): runs before normalising strips the "://".
  const https = /^\s*(?:add|ensure)\s+https?(?::\/\/)?\s*(?:prefix\s*)?(?:(?:to|on)\s+(.+?))?\s*$/i.exec(query)
  if (https) return [{ kind: 'text', op: 'https', field: https[1] ? fieldOf(` ${https[1].toLowerCase()} `) : undefined }]

  const { text, quotes } = normalize(query)
  const unquoted = text.replace(/¤\d+/g, ' ')

  const textEdit = parseText(query, text, quotes)
  if (textEdit) return [textEdit]
  // Quoted text is only ever a text payload.
  if (quotes.length) return []

  const edits = [parseCheckbox(unquoted), parseDate(unquoted), parseNumber(unquoted)].filter(
    (edit): edit is CmdRelativeEdit => !!edit,
  )
  const select = edits.length ? undefined : parseSelect(unquoted)
  if (select) return [select]
  // Data-matched readings come last; they only become rows when an option or member matches.
  return [...edits, parseOption(query, unquoted), parseUser(query, unquoted)].filter((edit): edit is CmdRelativeEdit => !!edit)
}

/** Picks the option a typed name means: exact, then prefix, then a one-letter typo; ambiguous gives none. */
export function matchCmdName(typed: string, names: string[]) {
  const needle = typed.trim().toLowerCase()
  if (!needle) return
  const lower = names.map((name) => name.toLowerCase())
  const exact = lower.findIndex((name) => name === needle)
  if (exact >= 0) return names[exact]

  // Parts a name is typed by: the whole name, its words, an email's local part and its words.
  const parts = lower.map((name) => {
    const local = name.split('@')[0]!
    return [...new Set([name, local, ...name.split(/[\s@._-]+/), ...local.split(/[._-]+/)].filter(Boolean))]
  })
  const unique = (hits: number[]) => (new Set(hits).size === 1 ? names[hits[0]!] : undefined)

  const prefix = parts.flatMap((keys, i) => (keys.some((key) => key.startsWith(needle)) ? [i] : []))
  if (prefix.length) return unique(prefix)

  // Typos: the start of a part as long as what was typed, a letter or two apart ("anbars" → "anbarasu").
  if (needle.length < 4) return
  const allowed = needle.length >= 8 ? 2 : 1
  const typo = parts.flatMap((keys, i) =>
    keys.some((key) =>
      [needle.length - 1, needle.length, needle.length + 1].some((n) => cmdEditDistance(needle, key.slice(0, n)) <= allowed),
    )
      ? [i]
      : [],
  )
  return unique(typo)
}

/** Levenshtein distance with adjacent swaps, for short strings. */
export function cmdEditDistance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0]![j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1)
    }
  }
  return d[a.length]![b.length]!
}

/** The first reading of a query as an edit; see `parseCmdRelativeEdits`. */
export function parseCmdRelativeEdit(query: string): CmdRelativeEdit | undefined {
  return parseCmdRelativeEdits(query)[0]
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
    case 'round-nearest':
      next = Math.round(value / edit.amount) * edit.amount
      break
    case 'at-least':
      next = Math.max(value, edit.amount)
      break
    case 'at-most':
      next = Math.min(value, edit.amount)
      break
    case 'negate':
      next = -value
      break
    case 'abs':
      next = Math.abs(value)
      break
    case 'floor':
      next = Math.floor(value)
      break
    case 'ceil':
      next = Math.ceil(value)
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
    case 'weekday': {
      const diff = (edit.weekday - date.day() + 7) % 7
      if (edit.which === 'this') return date.add(diff, 'day')
      if (edit.which === 'next') return date.add(diff || 7, 'day')
      return date.subtract((date.day() - edit.weekday + 7) % 7 || 7, 'day')
    }
    case 'start-of':
      return date.add(edit.offset, edit.unit).startOf(edit.unit)
    case 'end-of':
      return date.add(edit.offset, edit.unit).endOf(edit.unit)
  }
}

/** The new text, or `undefined` to leave an empty value alone. */
export function applyCmdTextEdit(edit: CmdRelativeEdit & { kind: 'text' }, prev: unknown): string | undefined {
  if (prev === null || prev === undefined || prev === '') return
  const value = String(prev)
  switch (edit.op) {
    case 'append':
      return value + edit.text
    case 'prepend':
      return edit.text + value
    case 'replace':
      return value.split(edit.from).join(edit.to)
    case 'remove':
      return value.split(edit.text).join('')
    case 'upper':
      return value.toUpperCase()
    case 'lower':
      return value.toLowerCase()
    case 'title':
      return value.toLowerCase().replace(/(^|[\s\-_/(])(\p{L})/gu, (_, sep: string, char: string) => sep + char.toUpperCase())
    case 'capitalize':
      return value.charAt(0).toUpperCase() + value.slice(1)
    case 'trim':
      return value.replace(/\s+/g, ' ').trim()
    case 'https':
      return /^[a-z][a-z\d+.-]*:\/\//i.test(value.trim()) ? value : `https://${value.trim()}`
  }
}

/** The new checkbox state; an empty value counts as unchecked. */
export function applyCmdCheckboxEdit(edit: CmdRelativeEdit & { kind: 'checkbox' }, prev: unknown): boolean {
  if (edit.op === 'check') return true
  if (edit.op === 'uncheck') return false
  return !(prev === true || prev === 1 || prev === '1' || prev === 'true')
}

/** The neighbouring option title, or `undefined` at either end. Empty moves to the first/last option. */
export function applyCmdSelectEdit(
  edit: CmdRelativeEdit & { kind: 'select' },
  prev: unknown,
  options: string[],
): string | undefined {
  if (!options.length) return
  const index = prev === null || prev === undefined || prev === '' ? -1 : options.indexOf(String(prev))
  if (index < 0) return edit.op === 'previous' ? options[options.length - 1] : options[0]
  if (edit.op === 'cycle') return options[(index + 1) % options.length]
  return options[edit.op === 'next' ? index + 1 : index - 1]
}

/** A multi-value list ("a,b" or an array) after adding, removing or toggling `item`; empty becomes null. */
export function applyCmdListEdit(op: 'add' | 'remove' | 'toggle' | 'clear', prev: unknown, item?: string): string | null {
  const list = typeof prev === 'string' && prev ? prev.split(',') : Array.isArray(prev) ? prev.map(String) : []
  if (op === 'clear' || !item) return null
  const has = list.includes(item)
  const next = op === 'remove' || (op === 'toggle' && has) ? list.filter((value) => value !== item) : has ? list : [...list, item]
  return next.length ? next.join(',') : null
}

/** Time-of-day shift that wraps past midnight, on the 1999-01-01 base date the Time cell stores. */
export function applyCmdTimeEdit(edit: CmdRelativeEdit & { kind: 'date' }, time: dayjs.Dayjs | undefined) {
  if (!time?.isValid() || edit.op !== 'shift' || (edit.unit !== 'minute' && edit.unit !== 'hour')) return
  const shifted = time.add(edit.amount, edit.unit)
  return time.year(1999).month(0).date(1).hour(shifted.hour()).minute(shifted.minute()).second(0)
}

/** Seconds a date shift adds to a duration; months and years have no fixed length. */
export function cmdShiftSeconds(edit: CmdRelativeEdit & { kind: 'date' }) {
  if (edit.op !== 'shift') return
  const seconds = { minute: 60, hour: 3600, day: 86400, week: 604800 } as Partial<Record<CmdDateUnit, number>>
  return seconds[edit.unit] === undefined ? undefined : edit.amount * seconds[edit.unit]!
}

export type CmdFillUnit = 'day' | 'week' | 'month' | 'year' | 'weekday'

/** A fill parsed from a Cmd+K query ("fill down", "number rows", "fill 1..10", "fill weekly from today"). */
export type CmdFill =
  | { kind: 'down' }
  | { kind: 'series' }
  | { kind: 'number'; start: number; step: number; end?: number }
  // Quoted text, a number, or a bare word that must name an option or a date ("fill Won", "fill today").
  | { kind: 'constant'; value: string; quoted: boolean }
  | { kind: 'text'; prefix: string; start: number; step: number; end?: number }
  | { kind: 'date'; unit: CmdFillUnit; step: number; from?: string }
  | { kind: 'cycle' }

/** What a fill writes to: decides which fills apply and how values are built. */
export type CmdFillType = 'number' | 'date' | 'text' | 'select' | 'other'

const FILL_NUM = String.raw`(-?(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)(?:k|m)?)`

const FILL_RANGE = String.raw`(?:\s?(?:\.\.\.?|…)\s?|\s(?:to|through|thru)\s|\s?-\s?)`

const FILL_DATE_FROM = /^(today|tomorrow|yesterday|\d{4}-\d{2}-\d{2}|(?:next |this |coming )?[a-z]{3,9})$/

const FILL_PERIODS: Record<string, [CmdFillUnit, number]> = {
  daily: ['day', 1],
  weekly: ['week', 1],
  fortnightly: ['week', 2],
  biweekly: ['week', 2],
  monthly: ['month', 1],
  quarterly: ['month', 3],
  yearly: ['year', 1],
  annually: ['year', 1],
  weekdays: ['weekday', 1],
}

function fillNumber(text: string) {
  const match = /^(-?[\d.,]+)(k|m)?$/.exec(text)
  if (!match) return NaN
  const value = Number(match[1]!.replace(/,/g, ''))
  return value * (match[2] === 'k' ? 1e3 : match[2] === 'm' ? 1e6 : 1)
}

/** A date a fill starts from: today/tomorrow/yesterday, an ISO date, or the coming weekday (today if it is one). */
export function resolveCmdFillDate(from: string, today = dayjs()) {
  const word = from.toLowerCase().trim()
  if (word === 'today') return today.startOf('day')
  if (word === 'tomorrow') return today.add(1, 'day').startOf('day')
  if (word === 'yesterday') return today.subtract(1, 'day').startOf('day')
  if (/^\d{4}-\d{2}-\d{2}$/.test(word)) {
    const date = dayjs(word, 'YYYY-MM-DD')
    return date.isValid() ? date : undefined
  }
  const weekday = WEEKDAY_NAMES[word.replace(/^(next|this|coming) /, '')]
  if (weekday === undefined) return
  const ahead = (weekday - today.day() + 7) % 7
  // "next monday" on a Monday means the one after; plain "monday" means today.
  return today.add(ahead === 0 && word.startsWith('next ') ? 7 : ahead, 'day').startOf('day')
}

/** Fill commands: they start with "fill", "number rows", "copy down", "continue series" or "cycle options". */
export function parseCmdFill(query: string): CmdFill | undefined {
  const raw = query.replace(/\s+/g, ' ').trim()
  const lower = raw.toLowerCase().replace(/[!?;:]+$/, '')

  const numbering = new RegExp(
    String.raw`^(?:renumber(?: the)?(?: rows| records| cells)?|number(?: the)? (?:rows|records|cells))(?: from ${FILL_NUM})?(?: (?:step|by|every) ${FILL_NUM})?$`,
  ).exec(lower)
  if (numbering) {
    const start = numbering[1] ? fillNumber(numbering[1]) : 1
    const step = numbering[2] ? fillNumber(numbering[2]) : 1
    return Number.isFinite(start) && Number.isFinite(step) && step !== 0 ? { kind: 'number', start, step } : undefined
  }
  if (/^(?:fill )?(?:cycle|rotate)(?: through)?(?: the)? options$/.test(lower)) return { kind: 'cycle' }
  if (/^copy down$/.test(lower)) return { kind: 'down' }
  if (/^(?:continue|extend)(?: the)? (?:series|pattern|sequence)$/.test(lower)) return { kind: 'series' }

  if (lower !== 'fill' && !lower.startsWith('fill ')) return
  const rest = lower.slice(4).trim()
  const restRaw = raw.slice(4).trim()

  if (!rest || /^down(?: from(?: the)? top)?$/.test(rest)) return { kind: 'down' }
  if (/^(?:the |a |in )?(?:series|pattern|sequence)$/.test(rest)) return { kind: 'series' }
  if (/^(?:the )?(?:options|cycle)$/.test(rest)) return { kind: 'cycle' }

  // Dates: "daily from today", "dates weekly from 2026-11-02", "every 2 days", "weekdays from monday".
  const dates =
    /^(?:(?:with )?dates? ?)?(?:(daily|weekly|fortnightly|biweekly|monthly|quarterly|yearly|annually|weekdays|business days|working days)|every(?: (\d+))? (day|week|month|year)s?)?(?: (?:from|starting(?: from)?|starting on|beginning) (.+))?$/.exec(
      rest,
    )
  if (dates && (dates[1] || dates[3] || (/^(?:with )?dates?\b/.test(rest) && dates[4]))) {
    const period = dates[1] ? FILL_PERIODS[dates[1].replace(/^(business|working) days$/, 'weekdays')] : undefined
    const unit = period?.[0] ?? (dates[3] as CmdFillUnit | undefined) ?? 'day'
    const step = (period?.[1] ?? 1) * (dates[2] ? Number(dates[2]) : 1)
    const from = dates[4]?.trim()
    if (from && (!FILL_DATE_FROM.test(from) || !resolveCmdFillDate(from))) return
    return step > 0 ? { kind: 'date', unit, step, from } : undefined
  }

  // Numbers: "1..10", "1 to 50", "from 100 step 10", "10, 20" (step from the two), "5" (constant).
  // "1,000" is one number, not the pair "1, 000".
  const pair = /^-?\d{1,3}(?:,\d{3})+(?:\.\d+)?(?:k|m)?$/.test(rest)
    ? null
    : new RegExp(String.raw`^${FILL_NUM} ?, ?${FILL_NUM}$`).exec(rest)
  if (pair) {
    const start = fillNumber(pair[1]!)
    const step = fillNumber(pair[2]!) - start
    return Number.isFinite(step) && step !== 0 ? { kind: 'number', start, step } : undefined
  }
  const numbers = new RegExp(
    String.raw`^(?:from )?${FILL_NUM}(?:${FILL_RANGE}${FILL_NUM}?)?(?: (?:step|by|every|increment) ${FILL_NUM})?$`,
  ).exec(rest)
  if (numbers) {
    const start = fillNumber(numbers[1]!)
    const end = numbers[2] ? fillNumber(numbers[2]) : undefined
    const explicitStep = numbers[3] ? fillNumber(numbers[3]) : undefined
    const isRange = new RegExp(FILL_RANGE).test(rest.replace(/^from /, '').replace(numbers[1]!, ''))
    if (!Number.isFinite(start) || (end !== undefined && !Number.isFinite(end))) return
    if (end === undefined && explicitStep === undefined && !isRange && !rest.startsWith('from ')) {
      return { kind: 'constant', value: String(start), quoted: false }
    }
    const step = explicitStep ?? (end !== undefined && end < start ? -1 : 1)
    if (!Number.isFinite(step) || step === 0) return
    return { kind: 'number', start, step, end }
  }

  // Text series on the original casing: "Item 1..10", "'INV-' 100..", "Week 1 to 12".
  const series = new RegExp(String.raw`^(.*?\D)(\d+)${FILL_RANGE}(\d+)?$`, 'i').exec(restRaw)
  if (series && /\p{L}/u.test(series[1]!)) {
    const prefix = series[1]!.replace(/^(["“‘'])(.*)(["”’'])\s?$/, '$2')
    const start = Number(series[2])
    const end = series[3] !== undefined ? Number(series[3]) : undefined
    return { kind: 'text', prefix, start, step: end !== undefined && end < start ? -1 : 1, end }
  }

  const quoted = /^(?:with )?(["“‘'])(.*)(["”’'])$/i.exec(restRaw)
  if (quoted) return { kind: 'constant', value: quoted[2]!, quoted: true }
  return { kind: 'constant', value: restRaw.replace(/^with /i, ''), quoted: false }
}

function isEmptyFillValue(value: unknown) {
  return value === null || value === undefined || value === ''
}

/** A month step when two dates share a day of the month, else a day step. */
function dateStep(a: dayjs.Dayjs, b: dayjs.Dayjs): [dayjs.ManipulateType, number] {
  const months = b.diff(a, 'month')
  if (months !== 0 && a.date() === b.date() && a.add(months, 'month').isSame(b, 'day')) return ['month', months]
  return ['day', b.diff(a, 'day')]
}

function addWeekdays(date: dayjs.Dayjs, count: number) {
  let next = date
  // Start on a weekday, then skip Saturdays and Sundays.
  while (next.day() === 0 || next.day() === 6) next = next.add(1, 'day')
  for (let i = 0; i < count; i++) {
    next = next.add(1, 'day')
    while (next.day() === 0 || next.day() === 6) next = next.add(1, 'day')
  }
  return next
}

/**
 * The value a fill writes to each of `count` cells, in order; `undefined` leaves a cell as it is.
 * Dates come back as YYYY-MM-DD, numbers as numbers, text and options as strings.
 */
export function cmdFillValues(
  fill: CmdFill,
  prevs: unknown[],
  type: CmdFillType,
  { options = [], today = dayjs() }: { options?: string[]; today?: dayjs.Dayjs } = {},
): unknown[] {
  const count = prevs.length
  const first = prevs[0]
  const leave = () => Array.from({ length: count }, () => undefined as unknown)

  switch (fill.kind) {
    case 'down':
      // The first cell is the source; it stays as it is.
      return isEmptyFillValue(first) ? leave() : prevs.map((_, i) => (i === 0 ? undefined : first))
    case 'constant': {
      const value = cmdFillConstant(fill, type, options, today)
      return value === undefined ? leave() : prevs.map(() => value)
    }
    case 'number':
      return prevs.map((_, i) => {
        const value = fill.start + i * fill.step
        if (fill.end !== undefined && (fill.step > 0 ? value > fill.end : value < fill.end)) return undefined
        return Number(value.toPrecision(15))
      })
    case 'text':
      return prevs.map((_, i) => {
        const value = fill.start + i * fill.step
        if (fill.end !== undefined && (fill.step > 0 ? value > fill.end : value < fill.end)) return undefined
        return `${fill.prefix}${value}`
      })
    case 'cycle': {
      if (!options.length) return leave()
      const offset = Math.max(0, options.indexOf(String(first ?? '')))
      return prevs.map((_, i) => options[(offset + i) % options.length])
    }
    case 'date': {
      const start = fill.from
        ? resolveCmdFillDate(fill.from, today)
        : !isEmptyFillValue(first) && dayjs(first as string).isValid()
        ? dayjs(first as string).startOf('day')
        : today.startOf('day')
      if (!start) return leave()
      return prevs.map((_, i) =>
        (fill.unit === 'weekday' ? addWeekdays(start, i * fill.step) : start.add(i * fill.step, fill.unit)).format('YYYY-MM-DD'),
      )
    }
    case 'series': {
      if (isEmptyFillValue(first)) return leave()
      if (type === 'number') {
        const a = Number(first)
        const b = isEmptyFillValue(prevs[1]) ? NaN : Number(prevs[1])
        if (!Number.isFinite(a)) return leave()
        const step = Number.isFinite(b) ? b - a : 1
        // The first two cells define the pattern; the rest continue it.
        return prevs.map((_, i) => (i < (Number.isFinite(b) ? 2 : 1) ? undefined : Number((a + i * step).toPrecision(15))))
      }
      if (type === 'date') {
        const a = dayjs(first as string)
        const b = isEmptyFillValue(prevs[1]) ? undefined : dayjs(prevs[1] as string)
        if (!a.isValid()) return leave()
        const [unit, step] = b?.isValid() ? dateStep(a.startOf('day'), b.startOf('day')) : (['day', 1] as const)
        if (step === 0) return leave()
        return prevs.map((_, i) =>
          i < (b?.isValid() ? 2 : 1)
            ? undefined
            : a
                .startOf('day')
                .add(i * step, unit)
                .format('YYYY-MM-DD'),
        )
      }
      return leave()
    }
  }
}

/** A constant fill as the target type holds it, or undefined when it doesn't fit ("fill out form" on any field). */
export function cmdFillConstant(
  fill: CmdFill & { kind: 'constant' },
  type: CmdFillType,
  options: string[] = [],
  today = dayjs(),
): unknown {
  const value = fill.value.trim()
  const asNumber = fill.quoted ? NaN : fillNumber(value.toLowerCase())
  switch (type) {
    case 'number':
      return Number.isFinite(asNumber) ? asNumber : undefined
    case 'text':
      return fill.quoted || Number.isFinite(asNumber) ? value : undefined
    case 'select':
      return matchCmdName(value, options)
    case 'date': {
      if (fill.quoted || !FILL_DATE_FROM.test(value.toLowerCase())) return
      return resolveCmdFillDate(value, today)?.format('YYYY-MM-DD')
    }
    default:
      return undefined
  }
}

/** Which fills a field of `type` takes; "fill down" takes any. */
export function cmdFillAccepts(fill: CmdFill, type: CmdFillType, options: string[] = []) {
  switch (fill.kind) {
    case 'down':
      return true
    case 'series':
      return type === 'number' || type === 'date'
    case 'number':
      return type === 'number'
    case 'text':
      return type === 'text'
    case 'date':
      return type === 'date'
    case 'cycle':
      return type === 'select' && options.length > 0
    case 'constant':
      return cmdFillConstant(fill, type, options) !== undefined
  }
}
