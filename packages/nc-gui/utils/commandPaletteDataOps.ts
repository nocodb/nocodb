import dayjs from 'dayjs'
import { cmdEditDistance, matchCmdName } from './commandPaletteRelativeEdit'
import type { StatAgg } from './cmdNl/vocab/aggregations'
import { AGG_WORDS, DATE_AGG } from './cmdNl/vocab/aggregations'
import type { CmdStatOp } from './cmdNl/vocab/comparators'
import { OP_WORDS } from './cmdNl/vocab/comparators'
import { MONTHS } from './cmdNl/vocab/dates'
import { FIELD_FILLERS, LEAD_FILLERS } from './cmdNl/vocab/fillers'
import { SUFFIX } from './cmdNl/vocab/numbers'
import { CLEAR_VERBS, SET_VERBS } from './cmdNl/vocab/verbs'

/* ------------------------------------------------------------------------------------------------
 * Calculator: "= 2500 * 1.18", "(10 + 5) / 3". A recursive-descent evaluator; never eval/Function.
 * ---------------------------------------------------------------------------------------------- */

type CalcToken = { kind: 'num'; value: number } | { kind: 'op'; value: string }

function tokenizeCalc(input: string): CalcToken[] | undefined {
  const tokens: CalcToken[] = []
  let i = 0
  while (i < input.length) {
    const ch = input[i]!
    if (/\s/.test(ch)) {
      i++
      continue
    }
    // 1,000 groups only (a comma followed by exactly three digits), decimals, then an optional k/m.
    const num = /^(?:\d{1,3}(?:,\d{3})+|\d+)?(?:\.\d+)?/.exec(input.slice(i))![0]
    if (num && /\d/.test(num)) {
      i += num.length
      let value = Number(num.replace(/,/g, ''))
      const suffix = input[i]?.toLowerCase()
      if (suffix && SUFFIX[suffix] && !/[a-z]/i.test(input[i + 1] ?? '')) {
        value *= SUFFIX[suffix]!
        i++
      }
      tokens.push({ kind: 'num', value })
      continue
    }
    if ('+-*/%^()×÷'.includes(ch)) {
      tokens.push({ kind: 'op', value: ch === '×' ? '*' : ch === '÷' ? '/' : ch })
      i++
      continue
    }
    return undefined
  }
  return tokens
}

function evaluateTokens(tokens: CalcToken[]): number | undefined {
  let pos = 0
  const peek = () => tokens[pos]
  const isOp = (value: string) => peek()?.kind === 'op' && peek()!.value === value
  // `%` before a number or "(" is modulo ("10 % 3"); otherwise it's a postfix percent ("200 * 10%").
  const startsOperand = (token?: CalcToken) => token?.kind === 'num' || (token?.kind === 'op' && token.value === '(')

  function expression(): number {
    let value = term()
    while (isOp('+') || isOp('-')) {
      const op = tokens[pos++]!.value
      const right = term()
      value = op === '+' ? value + right : value - right
    }
    return value
  }

  function term(): number {
    let value = unary()
    while (isOp('*') || isOp('/') || (isOp('%') && startsOperand(tokens[pos + 1]))) {
      const op = tokens[pos++]!.value
      const right = unary()
      value = op === '*' ? value * right : op === '/' ? value / right : value % right
    }
    return value
  }

  function unary(): number {
    if (isOp('-')) {
      pos++
      return -unary()
    }
    if (isOp('+')) {
      pos++
      return unary()
    }
    return power()
  }

  function power(): number {
    const base = postfix()
    if (isOp('^')) {
      pos++
      return base ** unary()
    }
    return base
  }

  function postfix(): number {
    let value = primary()
    while (isOp('%') && !startsOperand(tokens[pos + 1])) {
      pos++
      value /= 100
    }
    return value
  }

  function primary(): number {
    const token = tokens[pos++]
    if (token?.kind === 'num') return token.value
    if (token?.kind === 'op' && token.value === '(') {
      const value = expression()
      if (!isOp(')')) throw new Error('unbalanced')
      pos++
      return value
    }
    throw new Error('operand expected')
  }

  try {
    const value = expression()
    if (pos !== tokens.length) return undefined
    return Number.isFinite(value) ? value : undefined
  } catch {
    return undefined
  }
}

export interface CmdCalcResult {
  value: number
  expression: string
  /** Grouped for display ("2,950.5"). */
  display: string
  /** Ungrouped, for the clipboard ("2950.5"). */
  copy: string
}

/**
 * "= expr" always; a bare expression only when it is two or more numbers joined by an operator,
 * with no letters but k/m suffixes, so "+1w", "add 10" or "-5%" stay with relative edits.
 */
export function evaluateCmdCalc(query: string): CmdCalcResult | undefined {
  const trimmed = query.trim()
  const explicit = trimmed.startsWith('=')
  const expression = (explicit ? trimmed.slice(1) : trimmed).trim()
  if (!expression) return

  if (!explicit) {
    if (/[a-jl-z]/i.test(expression.replace(/(\d)[km](?![a-z])/gi, '$1'))) return
    // A date ("2026-10-14") or a lone signed number isn't a calculation.
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(expression)) return
    if (!/\d[\d.,km\s%]*\s*[-+*/%^×÷]\s*[(\-+]*\s*\d/i.test(expression)) return
  }

  const tokens = tokenizeCalc(expression)
  if (!tokens?.length) return
  const raw = evaluateTokens(tokens)
  if (raw === undefined) return

  // Twelve significant digits drop float noise (0.1 + 0.2 → 0.3).
  const value = Number(raw.toPrecision(12))
  return {
    value,
    expression,
    display: value.toLocaleString('en-US', { maximumFractionDigits: 10 }),
    copy: String(value),
  }
}

/* ------------------------------------------------------------------------------------------------
 * Quick stats: "sum of amount", "avg score where city is austin", "count where stage is won".
 * ---------------------------------------------------------------------------------------------- */

export type CmdStatKind = 'number' | 'date' | 'checkbox' | 'select' | 'user' | 'text'

export interface CmdStatColumn {
  id: string
  title: string
  kind: CmdStatKind
  /** Aggregations the footer offers for this column (getAvailableAggregations). */
  aggregations: string[]
  /** Select option titles. */
  options?: string[]
  /** User fields: the base members a name or email can mean. */
  members?: { id: string; name: string; email?: string }[]
}

export interface CmdStatCondition {
  column: CmdStatColumn
  op: CmdStatOp
  value?: string
  /** What to show for `value` when it is an id (a member's name, or "me"). */
  label?: string
}

export interface CmdStatQuery {
  aggregation: string
  /** Absent for a plain record count. */
  column?: CmdStatColumn
  where: CmdStatCondition[]
}

const NUMERIC_OPS = new Set(['gt', 'lt', 'gte', 'lte'])

function startsWithWords(words: string[], at: number, phrase: string[]) {
  return phrase.every((word, i) => words[at + i] === word)
}

function wordsOf(text: string) {
  return text
    .toLowerCase()
    .replace(/(\w)'s\b/g, '$1')
    .replace(/[?!,]/g, ' ')
    .replace(/[^\p{L}\p{N}\s<>=!'._-]/gu, ' ')
    .replace(/(>=|<=|!=|==|[<>=])/g, ' $1 ')
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * How well a typed word names a title word: 3 exact, 2 plural/prefix, 1 a typo (one edit for 5+ letters,
 * two for 8+, e.g. "referaal" → "referral"), 0 no match.
 */
function titleWordScore(typed: string, titleWord: string) {
  if (typed === titleWord) return 3
  if (typed === `${titleWord}s` || `${typed}s` === titleWord || typed === `${titleWord}es`) return 2
  if (typed.length >= 3 && titleWord.startsWith(typed)) return 2
  if (typed.length < 5) return 0
  return cmdEditDistance(typed, titleWord) <= (typed.length >= 8 ? 2 : 1) ? 1 : 0
}

interface ColumnMatch {
  column: CmdStatColumn
  length: number
  score: number
}

/**
 * Columns whose title words start at `at`: the longest titles, then the closest spelling. Several at
 * the same rank are a genuine ambiguity ("score" vs "score 2" typed as "scor").
 */
function matchColumnsAt(words: string[], at: number, columns: CmdStatColumn[]): ColumnMatch[] {
  const matches: ColumnMatch[] = []
  for (const column of columns) {
    const titleWords = wordsOf(column.title)
    if (!titleWords.length || at + titleWords.length > words.length) continue
    const scores = titleWords.map((word, i) => titleWordScore(words[at + i]!, word))
    if (scores.every(Boolean)) matches.push({ column, length: titleWords.length, score: Math.min(...scores) })
  }
  const longest = Math.max(0, ...matches.map((m) => m.length))
  const best = Math.max(0, ...matches.filter((m) => m.length === longest).map((m) => m.score))
  return matches.filter((m) => m.length === longest && m.score === best)
}

/** The one column at `at`, or none when nothing (or more than one) fits. */
function matchColumnAt(words: string[], at: number, columns: CmdStatColumn[]) {
  const matches = matchColumnsAt(words, at, columns)
  return matches.length === 1 ? matches[0] : undefined
}

function matchOption(column: CmdStatColumn, value: string) {
  const needle = value.trim().toLowerCase()
  return column.options?.find((option) => option.toLowerCase() === needle)
}

function parseCondition(words: string[], original: string[], columns: CmdStatColumn[]): CmdStatCondition | undefined {
  const field = matchColumnAt(words, 0, columns)
  if (!field) {
    // A bare option ("won") reads as "<the one select field that has it> is won".
    const value = original.join(' ')
    const owners = columns.filter((column) => column.kind === 'select' && matchOption(column, value))
    return owners.length === 1 ? { column: owners[0]!, op: 'eq', value: matchOption(owners[0]!, value) } : undefined
  }

  const { column } = field
  let at = field.length
  const opMatch = OP_WORDS.find(([phrase]) => startsWithWords(words, at, phrase))
  // "stage won" with no verb reads as "is".
  const op = opMatch?.[1] ?? 'eq'
  at += opMatch?.[0].length ?? 0
  const value = original.slice(at).join(' ').trim()

  if (op === 'blank' || op === 'notblank') return value ? undefined : { column, op }
  if (op === 'checked' || op === 'notchecked') return column.kind === 'checkbox' && !value ? { column, op } : undefined
  if (!value) return
  if (NUMERIC_OPS.has(op) && column.kind !== 'number' && column.kind !== 'date') return
  if (NUMERIC_OPS.has(op) && column.kind === 'number' && !Number.isFinite(Number(value.replace(/,/g, '')))) return

  if (column.kind === 'select') {
    if (op !== 'eq' && op !== 'neq') return
    const option = matchOption(column, value)
    return option ? { column, op, value: option } : undefined
  }
  if (column.kind === 'user') {
    if (op !== 'eq' && op !== 'neq' && op !== 'like') return
    const userOp = op === 'neq' ? 'nanyof' : 'anyof'
    if (/^(me|myself)$/i.test(value)) return { column, op: userOp, value: '@me', label: 'me' }
    // A member by name or email, typos allowed ("owner is like anbarasu").
    const members = column.members ?? []
    const byName = matchCmdName(
      value,
      members.map((m) => m.name),
    )
    const byEmail = byName
      ? undefined
      : matchCmdName(
          value,
          members.map((m) => m.email ?? ''),
        )
    const member = members.find((m) => (byName && m.name === byName) || (byEmail && m.email === byEmail))
    return member ? { column, op: userOp, value: member.id, label: member.name } : undefined
  }
  if (column.kind === 'checkbox') {
    const truthy = /^(true|yes|checked|done|1)$/i.test(value)
    const falsy = /^(false|no|unchecked|0)$/i.test(value)
    if (!truthy && !falsy) return
    return { column, op: (op === 'neq') === truthy ? 'notchecked' : 'checked' }
  }
  // Dates compare by exact day only through the filter menu's sub-ops; keep date where-clauses to empty checks.
  if (column.kind === 'date') return

  return { column, op, value: column.kind === 'number' ? value.replace(/,/g, '') : value }
}

/** Query words for parsing: punctuation dropped, possessives folded ("deal's" → "deal"), case kept for values. */
function queryTokens(query: string) {
  return query
    .replace(/(\w)'s\b/g, '$1')
    .replace(/[?!,]/g, ' ')
    .replace(/(>=|<=|!=|==|[<>=])/g, ' $1 ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

/** "a and b": the conditions of a where clause, in the view's filter vocabulary; undefined when any part doesn't parse. */
function parseClause(words: string[], original: string[], columns: CmdStatColumn[]): CmdStatCondition[] | undefined {
  if (!words.length || words.includes('or')) return
  const where: CmdStatCondition[] = []
  let start = 0
  for (let i = 0; i <= words.length; i++) {
    if (i === words.length || words[i] === 'and') {
      const condition = parseCondition(words.slice(start, i), original.slice(start, i), columns)
      if (!condition) return
      where.push(condition)
      start = i + 1
    }
  }
  return where
}

/** Parses a bare where clause ("stage is won and amount > 100"); undefined when any condition doesn't. */
export function parseCmdWhereClause(clause: string, columns: CmdStatColumn[]): CmdStatCondition[] | undefined {
  const original = queryTokens(clause)
  return parseClause(
    original.map((word) => word.toLowerCase()),
    original,
    columns,
  )
}

/** Splits "<action> where <clause>" on the last "where"; undefined when either side is empty. */
export function splitCmdWhere(query: string): { action: string; clause: string } | undefined {
  const match = /^(.*)\swhere\s(.*)$/is.exec(query.trim())
  if (!match) return
  const action = match[1]!.trim()
  const clause = match[2]!.trim()
  return action && clause ? { action, clause } : undefined
}

/** "set stage to won", "change amount = 5", "clear notes": an absolute value for one field. */
export type CmdSetAction = { column: CmdStatColumn } & ({ clear: true } | { clear?: false; value: string })

/** Parses an absolute edit; the value is kept as typed (quotes removed) for the caller to fit to the field. */
export function parseCmdSetAction(action: string, columns: CmdStatColumn[]): CmdSetAction | undefined {
  // Whitespace only: the value keeps its commas ("1,000") and punctuation.
  const original = action
    .replace(/(>=|<=|!=|==|[<>=])/g, ' $1 ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const words = original.map((word) => word.toLowerCase().replace(/(\w)'s$/, '$1'))
  const verb = words[0]
  if (!verb || (!SET_VERBS.has(verb) && !CLEAR_VERBS.has(verb))) return
  let at = 1
  if (words[at] === 'the') at++
  const field = matchColumnAt(words, at, columns)
  if (!field) return
  at += field.length

  if (CLEAR_VERBS.has(verb)) return at === words.length ? { column: field.column, clear: true } : undefined

  if (['to', '=', 'as', 'with'].includes(words[at]!)) at++
  const value = original
    .slice(at)
    .join(' ')
    .replace(/^["“'‘](.*)["”'’]$/, '$1')
    .trim()
  return value ? { column: field.column, value } : undefined
}

export type CmdStatReading =
  | { kind: 'query'; query: CmdStatQuery }
  /** Understood, but the footer has no such aggregation for this field's type. */
  | { kind: 'unsupported'; aggregation: StatAgg; column: CmdStatColumn; suggestions: string[] }
  /** The aggregation is clear but no field is called what followed it. */
  | { kind: 'no-field'; aggregation: StatAgg; text: string }
  /** The figure is clear but its condition isn't (an unknown member, option or operator). */
  | { kind: 'bad-condition'; aggregation: StatAgg; column?: CmdStatColumn; text: string }

/** At most this many rows when a typed name fits several fields equally well. */
const MAX_FIELD_CANDIDATES = 3

const SUGGESTED_AGGREGATIONS = ['count_unique', 'count_filled', 'count_empty']

function readingFor(agg: StatAgg, column: CmdStatColumn, where: CmdStatCondition[]): CmdStatReading {
  let aggregation: string = agg
  if (column.kind === 'date' && DATE_AGG[agg]) aggregation = DATE_AGG[agg]!
  if (agg === 'count') aggregation = 'count_filled'
  if (agg !== 'mode' && column.aggregations.includes(aggregation)) return { kind: 'query', query: { aggregation, column, where } }
  return {
    kind: 'unsupported',
    aggregation: agg,
    column,
    suggestions: SUGGESTED_AGGREGATIONS.filter((a) => column.aggregations.includes(a)),
  }
}

/**
 * Every reading of "<aggregation> [of] [<field>] [where <condition> [and …]]": a figure to fetch, or a
 * reason it can't be one. Empty when the query isn't a stat at all.
 */
export function parseCmdStats(query: string, columns: CmdStatColumn[]): CmdStatReading[] {
  let original = queryTokens(query)
  let words = original.map((word) => word.toLowerCase())

  // "what is the max …", "show me the total …".
  for (let opener = LEAD_FILLERS.find((p) => startsWithWords(words, 0, p)); opener; ) {
    original = original.slice(opener.length)
    words = words.slice(opener.length)
    opener = LEAD_FILLERS.find((p) => startsWithWords(words, 0, p))
  }
  if (!words.length) return []

  const aggEntry = AGG_WORDS.find(([phrase]) => startsWithWords(words, 0, phrase))
  let agg: StatAgg | undefined = aggEntry?.[1]
  let at = aggEntry?.[0].length ?? 0
  const isHowMany = agg === 'count'

  let fields: ColumnMatch[] = []
  if (agg) {
    // A field name wins over a filler of the same spelling (a field called "Value").
    while (at < words.length) {
      fields = matchColumnsAt(words, at, columns)
      if (fields.length || !FIELD_FILLERS.has(words[at]!)) break
      at++
    }
    if (fields.length) at += fields[0]!.length
    // "… for all rows" / "… across all records" trailing a field, before the end or a where clause.
    let skip = at
    while (skip < words.length && FIELD_FILLERS.has(words[skip]!)) skip++
    if (skip > at && (skip === words.length || words[skip] === 'where')) at = skip
  } else {
    // "<field> <agg>": "amount total", "score average".
    fields = matchColumnsAt(words, 0, columns)
    if (!fields.length) return []
    const trailing = AGG_WORDS.find(([phrase]) => startsWithWords(words, fields[0]!.length, phrase))
    if (!trailing || trailing[1] === 'count' || fields[0]!.length + trailing[0].length !== words.length) return []
    agg = trailing[1]
    at = words.length
  }

  // "how many deals are won", "count deals where …": up to two words naming the records, then the condition.
  if (isHowMany && !fields.length) {
    const from = at
    while (at < words.length && at - from < 2 && !['are', 'is', 'where', 'with', 'that', 'which'].includes(words[at]!)) at++
    if (at < words.length && !['are', 'is', 'where', 'with', 'that', 'which'].includes(words[at]!)) at = from
    if (words[at] === 'are' || words[at] === 'is') at++
  }

  let where: CmdStatCondition[] = []
  if (at < words.length) {
    const isClause = ['where', 'with', 'when', 'for', 'if', 'whose', 'that', 'which'].includes(words[at]!)
    if (!isClause && !isHowMany) {
      // "max referral sauce": the aggregation is clear, the field isn't; say so (letters only, not "top 10").
      const text = original.slice(at).join(' ')
      return !fields.length && agg !== 'count' && /\p{L}{3,}/u.test(text) ? [{ kind: 'no-field', aggregation: agg, text }] : []
    }
    if (isClause) at++
    const clause = parseClause(words.slice(at), original.slice(at), columns)
    if (!clause) {
      // Say why rather than vanish: "owner is like zed" with no member called zed.
      if (!fields.length && agg !== 'count') return []
      return [{ kind: 'bad-condition', aggregation: agg, column: fields[0]?.column, text: original.slice(at).join(' ') }]
    }
    where = clause
  }

  if (agg === 'count' && !fields.length) return [{ kind: 'query', query: { aggregation: 'count', where } }]
  if (!fields.length) return []
  return fields.slice(0, MAX_FIELD_CANDIDATES).map(({ column }) => readingFor(agg!, column, where))
}

/** The first figure a query asks for; undefined when it isn't a stat (or only an unsupported one). */
export function parseCmdStatsQuery(query: string, columns: CmdStatColumn[]): CmdStatQuery | undefined {
  const reading = parseCmdStats(query, columns).find((r) => r.kind === 'query')
  return reading?.kind === 'query' ? reading.query : undefined
}

/* ------------------------------------------------------------------------------------------------
 * Quick create: "new deal Acme 5000 won", "add record Cedar Retail Austin 30", "new deal stage: won, amount: 5k".
 * ---------------------------------------------------------------------------------------------- */

export type CmdCreateKind = 'text' | 'number' | 'date' | 'datetime' | 'select' | 'multiselect' | 'user' | 'checkbox' | 'other'

export interface CmdCreateColumn {
  title: string
  kind: CmdCreateKind
  /** Display (primary) column. */
  pv?: boolean
  /** Must be set on insert (required and no default). */
  required?: boolean
  options?: string[]
  /** Rating maximum. */
  max?: number
}

export interface CmdCreatePlan {
  /** Insert payload keyed by column title. */
  values: Record<string, unknown>
  /** What goes where, in column order, for the preview. */
  pairs: Array<{ column: CmdCreateColumn; display: string }>
  missingRequired: string[]
  /** Why the plan can't be inserted as typed. */
  error?: string
}

function parseCreateNumber(token: string) {
  const match = /^[$€£₹¥]?(-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|-?\.\d+)([km])?%?$/i.exec(token)
  if (!match) return
  const value = Number(match[1]!.replace(/,/g, '')) * (match[2] ? SUFFIX[match[2].toLowerCase()]! : 1)
  return Number.isFinite(value) ? value : undefined
}

/** today / tomorrow / yesterday / 2026-10-20 / "oct 20" / "20 oct": returns the day and how many tokens it used. */
function parseCreateDate(tokens: string[], at: number, now: dayjs.Dayjs) {
  const word = tokens[at]!.toLowerCase()
  if (word === 'today') return { date: now.startOf('day'), used: 1 }
  if (word === 'tomorrow') return { date: now.add(1, 'day').startOf('day'), used: 1 }
  if (word === 'yesterday') return { date: now.subtract(1, 'day').startOf('day'), used: 1 }
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(word)) {
    const date = dayjs(word, 'YYYY-M-D')
    return date.isValid() ? { date, used: 1 } : undefined
  }
  const next = tokens[at + 1]?.toLowerCase()
  const monthOf = (text?: string) => (text ? MONTHS.indexOf(text.slice(0, 3)) : -1)
  const dayOf = (text?: string) => (text && /^\d{1,2}(st|nd|rd|th)?$/.test(text) ? parseInt(text, 10) : NaN)
  for (const [monthText, dayText] of [
    [word, next],
    [next, word],
  ] as const) {
    const month = monthOf(monthText)
    const day = dayOf(dayText)
    if (month >= 0 && monthText && monthText.length >= 3 && /^[a-z]+$/.test(monthText) && day >= 1 && day <= 31) {
      const date = now.month(month).date(day).startOf('day')
      return date.month() === month ? { date, used: 2 } : undefined
    }
  }
}

function matchCreateColumn(name: string, columns: CmdCreateColumn[]) {
  const needle = name.trim().toLowerCase()
  return (
    columns.find((column) => column.title.toLowerCase() === needle) ??
    columns.find((column) => column.title.toLowerCase().startsWith(needle) && needle.length >= 3)
  )
}

/** Splits on spaces but keeps "…", “…” and '…' together, unquoted. */
function createTokens(text: string) {
  return [...text.matchAll(/"([^"]*)"|“([^”]*)”|'([^']*)'|(\S+)/g)].map((match) => ({
    text: match[1] ?? match[2] ?? match[3] ?? match[4]!,
    quoted: match[4] === undefined,
  }))
}

function singularForms(word: string) {
  const lower = word.toLowerCase()
  return new Set([lower, lower.replace(/s$/, ''), `${lower}s`, lower.replace(/ies$/, 'y'), lower.replace(/y$/, 'ies')])
}

/**
 * Reads "new <table> …", "new record …" or "add record …" and maps the rest onto the table's columns.
 * Undefined when the query isn't a quick create (so "new workflow Foo" stays a named create).
 */
export function parseCmdQuickCreate(
  query: string,
  ctx: { tableTitle: string; columns: CmdCreateColumn[]; now?: dayjs.Dayjs; currentUserLabel?: string },
): CmdCreatePlan | undefined {
  const text = query.trim()
  const lead = /^(new|add|create)\s+(\S+)(?:\s+(\S+))?\s*/i.exec(text)
  if (!lead) return

  const verb = lead[1]!.toLowerCase()
  const tableWords = ctx.tableTitle.toLowerCase().split(/\s+/)
  const first = lead[2]!.toLowerCase()
  const second = lead[3]?.toLowerCase()
  let consumed: number
  if (first === 'record' || first === 'row') consumed = 1
  else if (verb === 'new' && tableWords.length === 1 && singularForms(tableWords[0]!).has(first)) consumed = 1
  else if (
    verb === 'new' &&
    tableWords.length === 2 &&
    first === tableWords[0] &&
    second &&
    singularForms(tableWords[1]!).has(second)
  )
    consumed = 2
  else return

  const rest = text.replace(new RegExp(`^${lead[1]}\\s+${'\\S+\\s*'.repeat(consumed)}`, 'i'), '').trim()
  if (!rest) return

  const now = ctx.now ?? dayjs()
  const columns = ctx.columns.filter((column) => column.kind !== 'other')
  const values: Record<string, unknown> = {}
  const shown = new Map<string, string>()
  let error: string | undefined

  const assign = (column: CmdCreateColumn, value: unknown, display: string) => {
    values[column.title] = value
    shown.set(column.title, display)
  }

  // "field: value" and "field=value" segments, split on commas, are explicit.
  const free: string[] = []
  for (const segment of rest.split(',')) {
    const pair = /^\s*([^:=]+?)\s*[:=]\s*(.+?)\s*$/.exec(segment)
    const column = pair ? matchCreateColumn(pair[1]!, columns) : undefined
    if (!pair || !column) {
      free.push(segment)
      continue
    }
    const raw = pair[2]!.replace(/^["“']|["”']$/g, '')
    if (column.kind === 'number') {
      const number = parseCreateNumber(raw)
      if (number === undefined) error = `${column.title}: not a number`
      else assign(column, number, number.toLocaleString('en-US'))
    } else if (column.kind === 'select' || column.kind === 'multiselect') {
      const option = column.options?.find((o) => o.toLowerCase() === raw.toLowerCase())
      if (!option) error = `${column.title}: no option “${raw}”`
      else assign(column, option, option)
    } else if (column.kind === 'date' || column.kind === 'datetime') {
      const tokens = raw.split(/\s+/)
      const date = parseCreateDate(tokens, 0, now)
      if (!date || date.used !== tokens.length) error = `${column.title}: not a date`
      else
        assign(
          column,
          date.date.format(column.kind === 'date' ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm:ssZ'),
          date.date.format('MMM D, YYYY'),
        )
    } else if (column.kind === 'checkbox') {
      const on = /^(true|yes|checked|done|1|on)$/i.test(raw)
      assign(column, on, on ? '✓' : '✗')
    } else if (column.kind === 'user') {
      if (raw.toLowerCase() !== 'me') error = `${column.title}: only “me” is supported`
      else assign(column, '@me', ctx.currentUserLabel ?? 'me')
    } else {
      assign(column, raw, `“${raw}”`)
    }
  }

  const tokens = createTokens(free.join(' '))
  const textParts: string[] = []
  const taken = (column: CmdCreateColumn) => values[column.title] !== undefined
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!
    if (token.quoted) {
      textParts.push(token.text)
      continue
    }
    const lower = token.text.toLowerCase()

    // An option of a select field, longest multi-word option first.
    let optionHit: { column: CmdCreateColumn; option: string; used: number } | undefined
    for (const column of columns) {
      if ((column.kind !== 'select' && column.kind !== 'multiselect') || (column.kind === 'select' && taken(column))) continue
      for (const option of column.options ?? []) {
        const optionWords = option.toLowerCase().split(/\s+/)
        const typed = tokens.slice(i, i + optionWords.length).map((t) => t.text.toLowerCase())
        if (typed.join(' ') === optionWords.join(' ') && (!optionHit || optionWords.length > optionHit.used)) {
          optionHit = { column, option, used: optionWords.length }
        }
      }
    }
    if (optionHit) {
      const { column, option } = optionHit
      if (column.kind === 'multiselect') {
        const list = [...((values[column.title] as string[] | undefined) ?? []), option]
        assign(column, list, list.join(', '))
      } else assign(column, option, option)
      i += optionHit.used - 1
      continue
    }

    if (lower === 'me') {
      const user = columns.find((column) => column.kind === 'user' && !taken(column))
      if (user) {
        assign(user, '@me', ctx.currentUserLabel ?? 'me')
        continue
      }
    }

    const date = parseCreateDate(
      tokens.map((t) => t.text),
      i,
      now,
    )
    const dateColumn = date && columns.find((column) => (column.kind === 'date' || column.kind === 'datetime') && !taken(column))
    if (date && dateColumn) {
      assign(
        dateColumn,
        date.date.format(dateColumn.kind === 'date' ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH:mm:ssZ'),
        date.date.format('MMM D, YYYY'),
      )
      i += date.used - 1
      continue
    }

    const number = parseCreateNumber(token.text)
    const numberColumn = number !== undefined ? columns.find((column) => column.kind === 'number' && !taken(column)) : undefined
    if (number !== undefined && numberColumn) {
      if (numberColumn.max !== undefined && (number < 0 || number > numberColumn.max)) {
        error = `${numberColumn.title}: ${number} is outside 0–${numberColumn.max}`
      }
      assign(numberColumn, number, number.toLocaleString('en-US'))
      continue
    }

    textParts.push(token.text)
  }

  // Everything else is the record's name.
  if (textParts.length) {
    const primary = columns.find((column) => column.pv && column.kind === 'text' && !taken(column))
    if (primary) {
      const name = textParts.join(' ')
      assign(primary, name, `“${name}”`)
    } else error ??= `Couldn't place “${textParts.join(' ')}”`
  }

  const pairs = columns
    .filter((column) => shown.has(column.title))
    .map((column) => ({ column, display: shown.get(column.title)! }))
  if (!pairs.length && !error) return
  const missingRequired = ctx.columns
    .filter((column) => column.required && values[column.title] === undefined)
    .map((c) => c.title)
  return { values, pairs, missingRequired, error }
}
